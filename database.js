const { Pool } = require("pg");
const bcrypt = require("bcrypt");

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
let hospital;

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
        "mbbs_reg" varchar
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
        "id" int UNIQUE PRIMARY KEY NOT NULL,
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

exports.getPatientByID = getPatientByID = async (id) => {
	if (!id) return null;
	try {
		let res = await client.query("SELECT * FROM patient WHERE id = $1",
			[id]);
		if (res && res.rows && res.rows[0]) return res.rows[0];
		else return null;
	} catch (err) {
		console.log(err, `\n\ngetPatientByID ERROR: ${err.detail}\n MESSAGE ${err.message}`);
	}
};

exports.signupPatient = signupPatient = async (id, password) => {
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

exports.getAllPatients = getAllPatients = async () => {
	let res = await client.query("SELECT * from patient;");
	return res.rows || [];
};
exports.getAllDoctors = getAllDoctors = async () => {
	let res = await client.query("SELECT * from doctor;");
	return res.rows || [];
};

exports.setPatientData = setPatientData = async (id, { full_name, address, dob, gender, phone }) => {
	try {
		let res = await client.query("UPDATE patient SET full_name = $2, address = $3, dob = $4, gender = $5, phone = $6 WHERE id = $1", [
			id, full_name, address, dob, gender, phone
		]);
		if (res.command == "UPDATE") return "SUCCESS";
		else return null;
	} catch (err) {
		return null;
	}
}

exports.makeAppointment = makeAppointment = async ({ id, patient_id, doctor_id, date, status, reason }) => {
	try {
		date = date.replace(" +05.30", "+05:30");
		let res = await client.query("INSERT INTO appointment (id, patient_id, doctor_id, status, reason, date) VALUES ($1, $2, $3, $4, $5, $6)", [
			id, patient_id, doctor_id, status, reason, date
		]);
		if (res.command == "INSERT") return "SUCCESS";
		else return null;
	} catch (err) {
		console.log("makeAppointment Error: ", err)
		return null;
	}
}

exports.getAppointmentsByPatientID = getAppointmentsByPatientID = async (patient_id) => {
	try {
		let res = await client.query("SELECT * FROM appointment WHERE patient_id = $1", [patient_id]);
		if (res && res.rows) return res.rows;
		return [];
	} catch (err) {
		console.log("getAppointmentsByPatientID Error: ", err);
		return [];
	}
};

exports.getDoctorByID = getDoctorByID = async (id) => {
	try {
		let res = await client.query("SELECT * FROM doctor WHERE id = $1", [id]);
		if (res.rows && res.rows[0]) return res.rows[0];
		return [];
	} catch (err) {
		console.log("getDoctorByID Error: ", err);
		return null;
	}
}

// hospital
exports.getHospitalByName = getHospitalByName = async (name) => {
	try {
		let res = await client.query("SELECT * FROM hospital WHERE name = $1", [name]);
		if (res.rows && res.rows[0]) return res.rows[0];
		return [];
	} catch (err) {
		console.log('getHospitalByName Error: ', err);
		return null;
	}

}

// DOCTOR



// ADMIN