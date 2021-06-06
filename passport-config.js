const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcrypt");

const { getPatientByID, getDoctorByID, getAdminByID } = require("./database.js");
exports.initializePassport = async (passport) => {

	const authenticatePatient = async (req, email, password, done) => {
		let patient = await getPatientByID(email, true);
		if (patient == null) return done(null, false, req.flash('message', { type: 'danger', title: 'Patient Not Found', text: 'Try creating an account.' }));

		try {
			if (await bcrypt.compare(password, patient.password)) {
				return done(null, patient);
			} else return done(null, false, req.flash('message', { type: 'danger', title: 'Incorrect Credentials', text: 'Incorrect password entered.' }))
		} catch (err) {
			return done(err);
		}
	};

	const authenticateDoctor = async (req, email, password, done) => {
		let doctor = await getDoctorByID(email, true);
		if (doctor == null) return done(null, false, req.flash('message', { type: 'danger', title: 'Doctor Not Found', text: 'Contact hospital admin.' }));

		try {
			if (await bcrypt.compare(password, doctor.password)) {
				return done(null, doctor);
			} else return done(null, false, req.flash('message', { type: 'danger', title: 'Incorrect Credentials', text: 'Invalid password entered.' }))
		} catch (err) {
			return done(err);
		}
	};

	const authenticateAdmin = async (req, email, password, done) => {
		let admin = await getAdminByID(email, true);
		if (admin == null) return done(null, false, req.flash('message', { type: 'danger', title: 'Admin Not Found', text: 'Contact website developer.' }));

		try {
			if (await bcrypt.compare(password, admin.password)) {
				return done(null, admin);
			} else return done(null, false, req.flash('message', { type: 'danger', title: 'Incorrect Credentials', text: 'Incorrect password entered.' }))
		} catch (err) {
			return done(err);
		}
	};

	passport.use("patient", new LocalStrategy({ usernameField: "email", passReqToCallback: true }, authenticatePatient));
	passport.use("doctor", new LocalStrategy({ usernameField: "email", passReqToCallback: true }, authenticateDoctor));
	passport.use("admin", new LocalStrategy({ usernameField: "email", passReqToCallback: true }, authenticateAdmin));

	passport.serializeUser((user, done) => {
		done(null, { id: user.id, role: user.role })
	});
	passport.deserializeUser(async (data, done) => {
		let gotUser = null;
		if (data.role == "patient") gotUser = await getPatientByID(data.id);
		else if (data.role == "doctor") gotUser = await getDoctorByID(data.id);
		else if (data.role == "admin") gotUser = await getAdminByID(data.id);
		return done(null, gotUser);
	});
}