const { Pool } = require('pg');

let pool, client;
pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});
pool.on('error', async (err, client) => {
    console.log('Database Pool ERROR: ', err);
    console.log('Trying to reconnect to database...');
    CLIENT = await pool.connect()
});

exports.init = async () => {
    try {
        client = await pool.connect();
        console.log("Connected to database.");
    } catch (e) {
        console.log('Error connecting to database.');
    }

    // initialize tables if not exists
    client.query(`
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;

    CREATE TABLE IF NOT EXISTS "patient" (
        "id" varchar PRIMARY KEY,
        "full_name" varchar NOT NULL,
        "address" varchar NOT NULL,
        "dob" date NOT NULL,
        "gender" varchar,
        "phone" varchar NOT NULL,
        "password" varchar NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "doctor" (
        "id" varchar PRIMARY KEY,
        "full_name" varchar NOT NULL,
        "gender" varchar,
        "phone" varchar NOT NULL,
        "dob" date NOT NULL,
        "password" varchar NOT NULL,
        "specialization" varchar,
        "year_of_passing" int NOT NULL,
        "mbbs_reg" varchar NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "appointment" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "patient_id" varchar NOT NULL,
        "doctor_id" varchar NOT NULL,
        "status" varchar NOT NULL,
        "reason" varchar NOT NULL,
        "date" date NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "admin" (
        "id" int UNIQUE PRIMARY KEY NOT NULL,
        "phone" varchar NOT NULL,
        "password" varchar NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "hospital" (
        "name" varchar NOT NULL,
        "address" varchar,
        "phone" varchar NOT NULL
    );

    ALTER TABLE "appointment" ADD FOREIGN KEY ("patient_id") REFERENCES "patient" ("id");
    ALTER TABLE "appointment" ADD FOREIGN KEY ("doctor_id") REFERENCES "doctor" ("id");

    `);

    let testPatient = {
        id: "johndoe@gmail.com",
        full_name: "John Doe",
        address: "HNo 404, VIT Chennai",
        dob: "2002-04-07",
        gender: "M",
        phone: "+910123456789",
        password: "aw1222441@3=="
    }
    let response = await addPatient(testPatient);
    console.log(response);
};

exports.queryOne = queryOne = async (q) => {
    let res = await client.query(q);
    if (res.rows && res.rows[0]) return res.rows[0];
    return null;
}

function verifyPatientData(patient) {
    let { id, full_name, address, dob, gender, phone, password } = patient;
    let errors = [];
    if (!id) errors.push("No email provided.");
    if (!full_name) errors.push("No full name provided.");
    if (!address) errors.push("No address provided.");
    if (!dob) errors.push("No date of birth provided.");
    if (!gender) errors.push("No gender provided.");
    if (!phone) errors.push("No phone provided.");
    if (!password) errors.push("No password provided.");
    return errors;
}

exports.addPatient = addPatient = async (patient) => {
    let { id, full_name, address, dob, gender, phone, password } = patient;
    let errors = verifyPatientData(patient);
    if (errors.length != 0) return errors.join(' ');
    try {
        let res = await client.query('INSERT INTO patient (id, full_name, address, dob, gender, phone, password) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [id, full_name, address, dob, gender, phone, password]);
        console.log(res);
        if (res.command == "INSERT") return "SUCCESS";
    } catch (err) {
        console.log(err, `\n\naddPatient ERROR: ${err.detail}\n MESSAGE ${err.message}`)
    }
};