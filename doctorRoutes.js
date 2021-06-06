const { getPatientByID, getAppointmentsByDoctorID, completeAppointmentByDoctor } = require("./database.js");


module.exports = function (app, passport, renderTemplate) {

	function checkDoctorAuthenticated(req, res, next) {
		if (req.isAuthenticated() && req.user && req.user.role == "doctor") {
			return next();
		}
		req.session.returnTo = req.originalUrl;
		return res.redirect("/doctor/login");
	}

	function checkDoctorNotAuthenticated(req, res, next) {
		if (req.isAuthenticated() && req.user.role == "doctor") {
			return res.redirect("/doctor");
		}
		return next();
	}

	app.get("/doctor", async (req, res) => {
		renderTemplate(req, res, "pages/doctor/index");
	});

	// Get login
	app.get("/doctor/login", checkDoctorNotAuthenticated, (req, res) => {
		if (req.user && req.user.role == "doctor") res.redirect('/doctor');
		else renderTemplate(req, res, "pages/doctor/login");
	});

	app.post("/doctor/login", checkDoctorNotAuthenticated, passport.authenticate("doctor", {
		successReturnToOrRedirect: '/doctor',
		failureRedirect: "/doctor/login",
		failureFlash: true
	}));

	app.get("/doctor/logout", checkDoctorAuthenticated, (req, res) => {
		req.logOut();
		req.flash("message", { type: "success", title: "Logout Successfull", text: "You have been logged out successfully." });
		return res.redirect("/doctor");
	});

	app.get("/doctor/viewappointments", checkDoctorAuthenticated, async (req, res) => {
		let appointments = await getAppointmentsByDoctorID(req.user.id);
		let patientIDs = [];
		appointments.forEach(({ patient_id }) => {
			if (!patientIDs.includes(patient_id)) patientIDs.push(patient_id);
		});

		let patients = [];
		patientIDs.forEach(id => patients.push(getPatientByID(id)));
		patients = await Promise.all(patients);
		return renderTemplate(req, res, "pages/doctor/viewappointments", { appointments, patients });
	});

	app.post("/doctor/completeappointment", checkDoctorAuthenticated, async (req, res) => {
		let id = req.body.id;
		function showError(title, text) {
			req.flash("message", { type: "danger", title, text });
			return res.redirect("/doctor/viewappointments");
		}

		if (!id) {
			showError("Error", "Unable to mark appointment as complete.");
			return;
		}

		try {
			let response = await completeAppointmentByDoctor(id, req.user.id);
			if (response) {
				req.flash("message", { type: "success", title: "Success", text: "The appointment was marked as completed." });
				return res.redirect("/doctor/viewappointments");
			}
			req.flash("message", { type: "danger", title: "Error", text: "An error occured when marking appointment as complete." });
			return res.redirect("/doctor/viewappointments");
		} catch (err) {
			console.log(err);
		}
		return res.redirect("/doctor/viewappointments");
	});
}