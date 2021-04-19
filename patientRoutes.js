const { ensureLoggedIn } = require('connect-ensure-login');
const { getPatientByID, signupPatient, setPatientData,
	makeAppointment, getAppointmentsByPatientID, getDoctorByID } = require("./database.js");

module.exports = function (app, passport, renderTemplate) {
	//get signup
	app.get("/signup", checkNotAuthenticated, (_req, res) => {
		renderTemplate(req, res, "pages/signup", { message: null });
	});

	//post signup
	app.post("/signup", checkNotAuthenticated, async (req, res) => {
		let { email, password, confirmpassword } = req.body;

		let gotPatient = await getPatientByID(email);

		let message = {
			type: "danger",
			title: "Signup Failed",
			text: "Passwords dont match."
		};

		let returnError = (text) => {
			message.text = text;
			return renderTemplate(req, res, "pages/signup", { message });
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
			return renderTemplate(req, res, "pages/login", { message });
		};
	});

	//get personal
	app.get("/personal", ensureLoggedIn('/login'), checkPatientDataNotSet, (req, res) => {
		renderTemplate(req, res, "pages/personal", { message: null });
	});

	app.post("/personal", ensureLoggedIn('/login'), checkPatientDataNotSet, async (req, res) => {
		let { fullname, address, dob, gender, phone } = req.body;
		try {
			await setPatientData(req.user.id, {
				full_name: fullname, address, dob, gender, phone
			});
			return renderTemplate(req, res, "pages/index", { user: req.user, message: { type: "success", title: "Personal Data Updated", text: "Your personal data was successfully updated." } });
		} catch (err) {
			return renderTemplate(req, res, "pages/index", { user: req.user, message: { type: "danger", title: "Personal Data Not set", text: "Ensure all the fields are filled." } });
		}
	});

	//get login
	app.get("/login", checkNotAuthenticated, (req, res) => {
		if (req.user) res.redirect('/');
		else renderTemplate(req, res, "pages/login", { message: null });
	});

	app.post("/login", checkNotAuthenticated, passport.authenticate("local", {
		successReturnToOrRedirect: '/',
		failureRedirect: "/login",
		failureFlash: true
	}));

	app.get("/logout", ensureLoggedIn('/login'), (req, res) => {
		req.logOut();
		if (req.user) renderTemplate(req, res, "pages/index", { message: { type: "success", title: "Logout Successfull", text: "You have been logged out successfully." } });
		else res.redirect("/");
	})

	async function checkUserDataSet(req, res, next) {
		let user = req.user;
		if (!user.full_name) return res.redirect('/personal');
		return next();
	}

	async function checkPatientDataNotSet(req, res, next) {
		let user = req.user;
		if (user.full_name) return res.redirect("/");
		return next();
	}

	function checkAuthenticated(req, res, next) {
		if (req.isAuthenticated()) {
			return next();
		}
		req.session.returnTo = req.originalUrl;
		return res.redirect("/login");
	}

	function checkNotAuthenticated(req, res, next) {
		if (req.isAuthenticated()) {
			return res.redirect("/");
		}
		return next();
	}




	// SERVICES
	app.get("/makeappointment", ensureLoggedIn("/login"), checkUserDataSet, async (req, res) => {
		let doctors = await getAllDoctors();
		return renderTemplate(req, res, "pages/makeappointment", { user: req.user, doctors });
	});

	app.post("/makeappointment", ensureLoggedIn("/login"), checkUserDataSet, async (req, res) => {
		let { reason, doctor, datetime } = req.body;

		function returnError(title, text) {
			return renderTemplate(req, res, "pages/index", { user: req.user, message: { type: "danger", title, text } });
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
		return renderTemplate(req, res, "pages/index", { user: req.user, message: { type: "success", title: "Appointment Made Successfully", text: "Your appointment has been sent to the admin successfully and is waiting approval." } });
	});

	app.get("/viewappointments", ensureLoggedIn("/login"), checkUserDataSet, async (req, res) => {
		let appointments = await getAppointmentsByPatientID(req.user.id);

		let doctorIDs = [];
		appointments.forEach(({ doctor_id }) => {
			if (!doctorIDs.includes(doctor_id)) doctorIDs.push(doctor_id);
		});
		let doctors = [];
		doctorIDs.forEach(id => doctors.push(getDoctorByID(id)));
		doctors = await Promise.all(doctors);
		return renderTemplate(req, res, "pages/viewappointments", { user: req.user, appointments, doctors });
	});
}