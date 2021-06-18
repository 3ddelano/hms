const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const Filter = require("bad-words");
const customFilter = new Filter({ placeHolder: "x" });

let pool, client;
pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});
pool.on("error", async (err) => {
    console.log("Database Pool ERROR: ", err);
    console.log("Trying to reconnect to database...");
    client = await pool.connect();
});
// ------------------------------------------------------------------------------------ 
// ------------------------------------- INITIALIZE ----------------------------------- 
// ------------------------------------------------------------------------------------ 
exports.init = async () => {
    try {
        client = await pool.connect();
        console.log("Connected to database.");
    } catch (e) {
        console.log("Error connecting to database.");
    }

    // initialize tables if not exists
    await client.query(`
	CREATE TABLE IF NOT EXISTS "patient" (
        "id" varchar PRIMARY KEY,
		"password" varchar NOT NULL,

        "full_name" varchar,
        "address" varchar,
        "dob" date,
        "gender" varchar,
        "phone" varchar        
    );

    CREATE TABLE IF NOT EXISTS "doctor" (
        "id" varchar PRIMARY KEY,
		"password" varchar NOT NULL,

        "full_name" varchar,
        "gender" varchar,
        "phone" varchar,
        "dob" date,
        "specialization" varchar,
        "year_of_passing" int,
        "mbbs_reg" varchar UNIQUE
    );

    CREATE TABLE IF NOT EXISTS "appointment" (
        "id" varchar PRIMARY KEY,
        "patient_id" varchar NOT NULL,
        "doctor_id" varchar NOT NULL,
        "status" varchar NOT NULL,
        "reason" varchar NOT NULL,
        "date" timestamptz NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "admin" (
        "id" varchar PRIMARY KEY,
        "phone" varchar NOT NULL,
        "password" varchar NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "hospital" (
        "name" varchar PRIMARY KEY,
        "address" varchar NOT NULL,
        "phone" varchar NOT NULL
    );

    ALTER TABLE "appointment" ADD FOREIGN KEY ("patient_id") REFERENCES "patient" ("id");
    ALTER TABLE "appointment" ADD FOREIGN KEY ("doctor_id") REFERENCES "doctor" ("id");

    `);
};
// ------------------------------------------------------------------------------------ 
// ------------------------------------- PATIENT ------------------------------------- 
// ------------------------------------------------------------------------------------ 
function verifyPatientData(patient) {
    let { id, full_name, address, dob, gender, phone, password } = patient;
    let errors = [];
    if (!id) errors.push("No email provided.");
    if (!password) errors.push("No password provided.");
    if (!full_name) errors.push("No full name provided.");
    if (!dob) errors.push("No date of birth provided.");
    if (!gender) errors.push("No gender provided.");
    if (!address) errors.push("No address provided.");
    if (!phone) errors.push("No phone provided.");
    return errors;
}

exports.addPatientData = async (patient) => {
    let { id, full_name, address, dob, gender, phone, password } = patient;
    id = customFilter.clean(id);
    full_name = customFilter.clean(full_name);
    address = customFilter.clean(address);
    gender = customFilter.clean(gender);
    phone = customFilter.clean(phone);

    let errors = verifyPatientData(patient);
    if (errors.length != 0) return errors.join(" ");
    try {
        let res = await client.query("INSERT INTO patient (id, full_name, address, dob, gender, phone, password) VALUES ($1, $2, $3, $4, $5, $6, $7)",
            [id, full_name, address, dob, gender, phone, password]);
        if (res.command == "INSERT") return "SUCCESS";
    } catch (err) {
        console.log(err, `\n\naddPatientData ERROR: ${err.detail}\n MESSAGE ${err.message}`);
    }
};

const getPatientByID = async (id, alsoPassword) => {
    if (!id) return null;
    try {
        let res;
        res = await client.query("SELECT * FROM patient WHERE id = $1",
            [id]);
        if (res && res.rows && res.rows[0]) {
            if (!alsoPassword) {
                delete res.rows[0].password;
            }
            res.rows[0].role = "patient";
            return res.rows[0];
        }
        else return null;
    } catch (err) {
        console.log(err, `\n\ngetPatientByID ERROR: ${err.detail}\n MESSAGE ${err.message}`);
        return null;
    }
};
exports.getPatientByID = getPatientByID;

const signupPatient = async (id, password) => {
    let hashed_password = await bcrypt.hash(password, 10);
    try {
        let res = await client.query("INSERT INTO patient (id, password) VALUES ($1, $2) ON CONFLICT DO NOTHING;",
            [id, hashed_password]);
        if (res.command == "INSERT") return "SUCCESS";
        else return null;
    } catch (err) {
        console.log(err, `\n\nsignupPatient ERROR: ${err.detail}\n MESSAGE ${err.message}`);
    }
};
exports.signupPatient = signupPatient;

const getAllPatients = async () => {
    let res = await client.query("SELECT * from patient;");
    if (res && res.rows) {
        res.rows.map(row => {
            if (row.password) delete row.password;
        });
    }
    return res.rows || [];
};
exports.getAllPatients = getAllPatients;

const getAllDoctors = async () => {
    let res = await client.query("SELECT * FROM doctor;");
    res.rows.map(row => {
        if (row.password) delete row.password;
    });
    return res.rows || [];
};
exports.getAllDoctors = getAllDoctors;

const setPatientData = async (id, { full_name, address, dob, gender, phone }) => {
    try {
        full_name = customFilter.clean(full_name);
        address = customFilter.clean(address);
        gender = customFilter.clean(gender);
        phone = customFilter.clean(phone);
        let res = await client.query("UPDATE patient SET full_name = $2, address = $3, dob = $4, gender = $5, phone = $6 WHERE id = $1", [
            id, full_name, address, dob, gender, phone
        ]);
        if (res.command == "UPDATE") return "SUCCESS";
        else return null;
    } catch (err) {
        console.log("setPatientData Error: ", err);
        return null;
    }
};
exports.setPatientData = setPatientData;

const makeAppointment = async ({ id, patient_id, doctor_id, date, status, reason }) => {
    try {
        date = date.replace(" +05.30", "+05:30");
        reason = customFilter.clean(reason);
        status = customFilter.clean(status);
        let res = await client.query("INSERT INTO appointment (id, patient_id, doctor_id, status, reason, date) VALUES ($1, $2, $3, $4, $5, $6)", [
            id, patient_id, doctor_id, status, reason, date
        ]);
        if (res.command == "INSERT") return "SUCCESS";
        else return null;
    } catch (err) {
        console.log("makeAppointment Error: ", err);
        return null;
    }
};
exports.makeAppointment = makeAppointment;

const cancelAppointmentByPatient = async (id, patientId) => {
    try {
        let res = await client.query("UPDATE appointment SET status = 'CANCELLED' WHERE id = $1 AND patient_id = $2", [
            id, patientId
        ]);
        if (res.command && res.command == "UPDATE") return true;
        return false;
    } catch (err) {
        console.log("cancelAppointmentByPatient Error: ", err);
        return null;
    }
};
exports.cancelAppointmentByPatient = cancelAppointmentByPatient;

const getAppointmentsByPatientID = async (patient_id) => {
    try {
        let res = await client.query("SELECT * FROM appointment WHERE patient_id = $1", [patient_id]);
        if (res && res.rows) return res.rows;
        return [];
    } catch (err) {
        console.log("getAppointmentsByPatientID Error: ", err);
        return [];
    }
};
exports.getAppointmentsByPatientID = getAppointmentsByPatientID;
// ------------------------------------------------------------------------------------ 
// ------------------------------------- HOSPITAL ------------------------------------- 
// ------------------------------------------------------------------------------------ 
const getHospitalByName = async (name) => {
    try {
        let res = await client.query("SELECT * FROM hospital WHERE name = $1", [name]);
        if (res.rows && res.rows[0]) return res.rows[0];
        return [];
    } catch (err) {
        console.log("getHospitalByName Error: ", err);
        return null;
    }

};
exports.getHospitalByName = getHospitalByName;
// ---------------------------------------------------------------------------------- 
// ------------------------------------- DOCTOR ------------------------------------- 
// ---------------------------------------------------------------------------------- 
const getDoctorByID = async (id, alsoPassword) => {
    if (!id) return null;
    try {
        let res;
        res = await client.query("SELECT * FROM doctor WHERE id = $1",
            [id]);
        if (res && res.rows && res.rows[0]) {
            if (!alsoPassword) {
                delete res.rows[0].password;
            }
            res.rows[0].role = "doctor";
            return res.rows[0];
        }
        else return null;
    } catch (err) {
        console.log(err, `\n\ngetDoctorByID ERROR: ${err.detail}\n MESSAGE ${err.message}`);
        return null;
    }
};
exports.getDoctorByID = getDoctorByID;

const getAppointmentsByDoctorID = async (doctor_id) => {
    try {
        let res = await client.query("SELECT * FROM appointment WHERE doctor_id = $1 AND status = 'APPROVED'", [doctor_id]);
        if (res && res.rows) return res.rows;
        return [];
    } catch (err) {
        console.log("getAppointmentsByDoctorID Error: ", err);
        return [];
    }
};
exports.getAppointmentsByDoctorID = getAppointmentsByDoctorID;

const completeAppointmentByDoctor = async (id, doctor_id) => {
    try {
        let res = await client.query("UPDATE appointment SET status = 'COMPLETED' WHERE id = $1 AND doctor_id = $2", [
            id, doctor_id
        ]);
        if (res.command && res.command == "UPDATE") return true;
        return false;
    } catch (err) {
        console.log("completeAppointmentByDoctor Error: ", err);
        return null;
    }
};
exports.completeAppointmentByDoctor = completeAppointmentByDoctor;

// ---------------------------------------------------------------------------------- 
// ------------------------------------- ADMIN -------------------------------------- 
// ---------------------------------------------------------------------------------- 

const getAllAppointments = async () => {
    try {
        let res = await client.query("SELECT * FROM appointment WHERE status = 'WAITING_APPROVAL'");
        if (res && res.rows) return res.rows;
        return [];
    } catch (err) {
        console.log("getAllAppointments Error: ", err);
        return [];
    }
};
exports.getAllAppointments = getAllAppointments;


const getAdminByID = async (id, alsoPassword) => {
    if (!id) return null;
    try {
        let res;
        res = await client.query("SELECT * FROM admin WHERE id = $1",
            [id]);
        if (res && res.rows && res.rows[0]) {
            if (!alsoPassword) {
                delete res.rows[0].password;
            }
            res.rows[0].role = "admin";
            return res.rows[0];
        }
        else return null;
    } catch (err) {
        console.log(err, `\n\ngetAdminByID ERROR: ${err.detail}\n MESSAGE ${err.message}`);
        return null;
    }
};
exports.getAdminByID = getAdminByID;

const approveAppointmentByAdmin = async (id) => {
    try {
        let res = await client.query("UPDATE appointment SET status = 'APPROVED' WHERE id = $1", [id]);
        if (res.command && res.command == "UPDATE") return true;
        return false;
    } catch (err) {
        console.log("approveAppointmentByAdmin Error: ", err);
        return null;
    }
};
exports.approveAppointmentByAdmin = approveAppointmentByAdmin;

const cancelAppointmentByAdmin = async (id) => {
    try {
        let res = await client.query("UPDATE appointment SET status = 'CANCELLED' WHERE id = $1", [id]);
        if (res.command && res.command == "UPDATE") return true;
        return false;
    } catch (err) {
        console.log("cancelAppointmentByAdmin Error: ", err);
        return null;
    }
};
exports.cancelAppointmentByAdmin = cancelAppointmentByAdmin;

const getDoctorByMBBS = async (mbbs_reg, alsoPassword) => {
    if (!mbbs_reg) return null;
    try {
        let res;
        res = await client.query("SELECT * FROM doctor WHERE mbbs_reg = $1",
            [mbbs_reg]);
        if (res && res.rows && res.rows[0]) {
            if (!alsoPassword) {
                delete res.rows[0].password;
            }
            res.rows[0].role = "doctor";
            return res.rows[0];
        }
        else return null;
    } catch (err) {
        console.log(err, `\n\ngetDoctorByMBBS ERROR: ${err.detail}\n MESSAGE ${err.message}`);
        return null;
    }
};
exports.getDoctorByMBBS = getDoctorByMBBS;

exports.addDoctor = async (id, { full_name, password, gender, phone, specialization, year_of_passing, mbbs_reg, dob }) => {
    if (!id) return;
    full_name = customFilter.clean(full_name);
    gender = customFilter.clean(gender);
    phone = customFilter.clean(phone);
    specialization = customFilter.clean(specialization);
    mbbs_reg = customFilter.clean(mbbs_reg);
    let hashed_password = await bcrypt.hash(password, 10);
    try {
        let res = await client.query("INSERT INTO doctor (id, password, full_name, gender, phone, specialization, year_of_passing, mbbs_reg, dob) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
            [id, hashed_password, full_name, gender, phone, specialization, year_of_passing, mbbs_reg, dob]);
        if (res.command == "INSERT") return "SUCCESS";
    } catch (err) {
        console.log(err, `\n\naddDoctor ERROR: ${err.detail}\n MESSAGE ${err.message}`);
    }
};

exports.deleteDoctor = async (id) => {
    if (!id) return;
    try {
        let res = await client.query("DELETE FROM doctor WHERE id = $1",
            [id]);
        if (res.command == "DELETE") return "SUCCESS";
    } catch (err) {
        console.log(err, `\n\ndeleteDoctor ERROR: ${err.detail}\n MESSAGE ${err.message}`);
    }
};