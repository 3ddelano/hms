const { getPatientByID, signupPatient, setPatientData,
	makeAppointment, getAppointmentsByPatientID, getDoctorByID, getAllDoctors, deleteAppointmentByPatient } = require("./database.js");

module.exports = function (app, passport, renderTemplate) {
	//get signup
	app.get("/signup", checkPatientNotAuthenticated, (req, res) => {
		renderTemplate(req, res, "pages/patient/signup");
	});

	//post signup
	app.post("/signup", checkPatientNotAuthenticated, async (req, res) => {
		let { email, password, confirmpassword } = req.body;

		let gotPatient = await getPatientByID(email);

		let message = {
			type: "danger",
			title: "Signup Failed",
			text: "Passwords dont match."
		};

		let returnError = (text) => {
			message.text = text;
			req.flash("message", message);
			return res.redirect("/signup");
		};

		if (gotPatient != null) {
			return returnError("Email address already exists. Try to Login instead.");
		} else {
			// we have a new patient
			if (password != confirmpassword) return returnError("Passwords don't match.");
			if (password.length < 5) return returnError("Password needs to be more than 5 characters long.");

			// add the patient into database
			await signupPatient(email, password);
			message.type = "success";
			message.title = "Signup Successfull";
			message.text = "Successfully signed up.";
			req.flash("message", message);
			return res.redirect("/login");
		};
	});

	function checkPatientAuthenticated(req, res, next) {
		if (req.isAuthenticated() && req.user && req.user.role == "patient") {
			return next();
		}
		req.session.returnTo = req.originalUrl;
		return res.redirect("/login");
	}

	//get personal
	app.get("/personal", checkPatientAuthenticated, checkPatientDataNotSet, (req, res) => {
		renderTemplate(req, res, "pages/patient/personal");
	});

	app.post("/personal", checkPatientAuthenticated, checkPatientDataNotSet, async (req, res) => {
		let { fullname, address, dob, gender, phone } = req.body;
		try {
			await setPatientData(req.user.id, {
				full_name: fullname, address, dob, gender, phone
			});
			req.flash("message", { type: "success", title: "Personal Data Updated", text: "Your personal data was successfully updated." })
			return res.redirect("/");
		} catch (err) {
			req.flash("message", { type: "danger", title: "Personal Data Not set", text: "Ensure all the fields are filled correctly." })
			return res.redirect("/");
		}
	});

	//get login
	app.get("/login", checkPatientNotAuthenticated, (req, res) => {
		if (req.user && req.user.role == "patient") res.redirect('/');
		else renderTemplate(req, res, "pages/patient/login");
	});

	app.post("/login", checkPatientNotAuthenticated, passport.authenticate("patient", {
		successReturnToOrRedirect: '/',
		failureRedirect: "/login",
		failureFlash: true
	}));

	app.get("/logout", checkPatientAuthenticated, (req, res) => {
		req.logOut();
		req.flash("message", { type: "success", title: "Logout Successfull", text: "You have been logged out successfully." });
		return res.redirect("/");
	})

	async function checkPatientDataSet(req, res, next) {
		let user = req.user;
		if (req.user.role == "patient" && !user.full_name) return res.redirect('/personal');
		return next();
	}

	async function checkPatientDataNotSet(req, res, next) {
		let user = req.user;
		if (req.user.role == "patient" && user.full_name) return res.redirect("/");
		return next();
	}

	function checkPatientNotAuthenticated(req, res, next) {
		if (req.isAuthenticated() && req.user.role == "patient") {
			return res.redirect("/");
		}
		return next();
	}




	// SERVICES
	app.get("/makeappointment", checkPatientAuthenticated, checkPatientDataSet, async (req, res) => {
		let doctors = await getAllDoctors();
		return renderTemplate(req, res, "pages/patient/makeappointment", { user: req.user, doctors });
	});

	app.post("/makeappointment", checkPatientAuthenticated, checkPatientDataSet, async (req, res) => {
		let { reason, doctor, datetime } = req.body;

		function returnError(title, text) {
			req.flash('message', { type: "danger", title, text });
			return res.redirect('/makeappointment');
		}
		if (!reason || reason.length < 5) return returnError("Making Appointment Failed", "Please enter a reason (more than 5 characters).");
		if (reason.length > 2000) return returnError("Making Appointment Failed", "Please enter a reason (less than 2000 characters).");
		if (!doctor) return returnError("Making Appointment Failed", "Please choose one doctor.");
		if (!datetime) return returnError("Making Appointment Failed", "Please enter a valid date and time in the format [yyyy-mm-dd hh:mm +05:30] (Indian Standard Time)")

		try {
			await makeAppointment({
				id: `${Date.now()}`,
				patient_id: req.user.id,
				doctor_id: doctor,
				status: "WAITING_APPROVAL",
				reason,
				date: datetime
			});
		} catch (err) {
			console.log('makeAppointment Error: ', err);
			return returnError("Making Appointment Failed", "Please enter a valid date and time in the format [yyyy-mm-dd hh:mm +05:30] (Indian Standard Time)");
		}
		req.flash("message", { type: "success", title: "Appointment Made Successfully", text: "Your appointment has been sent to the admin and is waiting approval." });
		return res.redirect('/makeappointment');
	});

	app.get("/viewappointments", checkPatientAuthenticated, checkPatientDataSet, async (req, res) => {
		let appointments = await getAppointmentsByPatientID(req.user.id);

		let doctorIDs = [];
		appointments.forEach(({ doctor_id }) => {
			if (!doctorIDs.includes(doctor_id)) doctorIDs.push(doctor_id);
		});
		let doctors = [];

		doctorIDs.forEach(id => doctors.push(getDoctorByID(id)));
		doctors = await Promise.all(doctors);
		return renderTemplate(req, res, "pages/patient/viewappointments", { appointments, doctors });
	});

	app.post("/cancelappointment", checkPatientAuthenticated, async (req, res) => {
		let id = req.body.id;

		function showError(title, text) {
			req.flash("message", { type: "danger", title, text });
			return res.redirect("/viewappointments");
		}

		if (!id) {
			showError("Error", "Unable to cancel appointment.");
			return;
		}

		try {
			let response = await deleteAppointmentByPatient(id, req.user.id);
			if (response) {
				req.flash("message", { type: "success", title: "Appointment Cancelled", text: "Your appointment was cancelled successfully." });
				return res.redirect("/viewappointments");
			}
			req.flash("message", { type: "danger", title: "Error", text: "An error occured when cancelling appointment." });
			return res.redirect("/viewappointments");
		} catch (err) {
			console.log(err);
		}
		return res.redirect("/viewappointments");
	});

	app.get("/viewdoctors", checkPatientAuthenticated, async (req, res) => {
		let doctors = await getAllDoctors();
		return renderTemplate(req, res, "pages/patient/viewdoctors", { doctors });
	});
}