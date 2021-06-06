const { getPatientByID, getAllAppointments, approveAppointmentByAdmin,
	getDoctorByID, getDoctorByMBBS, addDoctor, deleteDoctor } = require("./database.js");

const isNum = require("is-number");
const Filter = require("bad-words");
const filter = new Filter();

module.exports = function (app, passport, renderTemplate) {

	function checkAdminAuthenticated(req, res, next) {
		if (req.isAuthenticated() && req.user && req.user.role == "admin") {
			return next();
		}
		req.session.returnTo = req.originalUrl;
		return res.redirect("/admin/login");
	}

	function checkAdminNotAuthenticated(req, res, next) {
		if (req.isAuthenticated() && req.user.role == "admin") {
			return res.redirect("/admin");
		}
		return next();
	}

	app.get("/admin", async (req, res) => {
		renderTemplate(req, res, "pages/admin/index");
	});

	// Get login
	app.get("/admin/login", checkAdminNotAuthenticated, (req, res) => {
		if (req.user && req.user.role == "admin") res.redirect('/admin');
		else renderTemplate(req, res, "pages/admin/login");
	});

	app.post("/admin/login", checkAdminNotAuthenticated, passport.authenticate("admin", {
		successReturnToOrRedirect: '/admin',
		failureRedirect: "/admin/login",
		failureFlash: true
	}));

	app.get("/admin/logout", checkAdminAuthenticated, (req, res) => {
		req.logOut();
		req.flash("message", { type: "success", title: "Logout Successfull", text: "You have been logged out successfully." });
		return res.redirect("/admin");
	});

	app.get("/admin/viewappointments", checkAdminAuthenticated, async (req, res) => {
		let appointments = await getAllAppointments();
		let patientIDs = [];
		appointments.forEach(({ patient_id }) => {
			if (!patientIDs.includes(patient_id)) patientIDs.push(patient_id);
		});

		let patients = [];
		patientIDs.forEach(id => patients.push(getPatientByID(id)));
		patients = await Promise.all(patients);
		return renderTemplate(req, res, "pages/admin/viewappointments", { appointments, patients });
	});

	app.get("/admin/viewdoctors", checkAdminAuthenticated, async (req, res) => {
		let doctors = await getAllDoctors();
		return renderTemplate(req, res, "pages/admin/viewdoctors", { doctors });
	});

	app.post("/admin/approveappointment", checkAdminAuthenticated, async (req, res) => {
		let id = req.body.id;
		function showError(title, text) {
			req.flash("message", { type: "danger", title, text });
			return res.redirect("/admin/viewappointments");
		}

		if (!id) {
			showError("Error", "Unable to mark appointment as approved.");
			return;
		}

		try {
			let response = await approveAppointmentByAdmin(id, req.user.id);
			if (response) {
				req.flash("message", { type: "success", title: "Success", text: "The appointment was marked as approved." });
				return res.redirect("/admin/viewappointments");
			}
			req.flash("message", { type: "danger", title: "Error", text: "An error occured when marking appointment as approved." });
			return res.redirect("/admin/viewappointments");
		} catch (err) {
			console.log(err);
		}
		return res.redirect("/admin/viewappointments");
	});

	app.post("/admin/cancelappointment", checkAdminAuthenticated, async (req, res) => {
		let id = req.body.id;
		function showError(title, text) {
			req.flash("message", { type: "danger", title, text });
			return res.redirect("/admin/viewappointments");
		}

		if (!id) {
			showError("Error", "Unable to mark appointment as cancelled.");
			return;
		}

		try {
			let response = await cancelAppointmentByAdmin(id, req.user.id);
			if (response) {
				req.flash("message", { type: "success", title: "Success", text: "The appointment was marked as cancelled." });
				return res.redirect("/admin/viewappointments");
			}
			req.flash("message", { type: "danger", title: "Error", text: "An error occured when marking appointment as cancelled." });
			return res.redirect("/admin/viewappointments");
		} catch (err) {
			console.log(err);
		}
		return res.redirect("/admin/viewappointments");
	});

	app.get("/admin/adddoctor", checkAdminAuthenticated, async (req, res) => {
		let doctors = await getAllDoctors();
		return renderTemplate(req, res, "pages/admin/adddoctor", { doctors });
	});

	app.post("/admin/adddoctor", checkAdminAuthenticated, async (req, res) => {
		let { id, password, full_name, gender, phone, specialization, year_of_passing, mbbs_reg, dob } = req.body;

		let message = {
			type: "danger",
			title: "Error",
			text: "Doctor with email already exists."
		};
		let returnError = (text) => {
			message.text = text;
			req.flash("message", message);
			return res.redirect("/admin/adddoctor");
		};

		try {
			if (filter.isProfane(id)) return returnError("Email contains explicit content.");
			let doesExists = await getDoctorByID(id);
			let doesExists2 = await getDoctorByMBBS(mbbs_reg);
			if (doesExists) return returnError("Doctor with email already exists.");
			if (doesExists2) return returnError("Doctor with MBBS Registration Number already exists.")
			if (password.length < 5) return returnError("Password must be more than 5 characters.")
			if (!isNum(year_of_passing) || Number(year_of_passing) > new Date().getFullYear()) return returnError("Year of passing must be a valid year.");
			year_of_passing = Number(year_of_passing);
			await addDoctor(id, {
				full_name, gender, phone, specialization, year_of_passing, mbbs_reg, dob, password
			});
			req.flash("message", { type: "success", title: "Success", text: "The doctor was added successfully." })
			return res.redirect("/admin");
		} catch (err) {
			console.log("adddoctor Error: ", err)
			req.flash("message", { type: "danger", title: "Add Doctor Error", text: "Ensure all the fields are filled correctly." })
			return res.redirect("/admin");
		}
	});

	app.post("/admin/deletedoctor", checkAdminAuthenticated, async (req, res) => {
		let { id } = req.body;

		let message = {
			type: "danger",
			title: "Error",
			text: "Doctor doesn't exist."
		};
		let returnError = (text) => {
			message.text = text;
			req.flash("message", message);
			return res.redirect("/admin/viewdoctors");
		};

		try {
			let doesExists = await getDoctorByID(id);
			if (!doesExists) return returnError("Doctor with email doesn't exist.");

			await deleteDoctor(id);
			req.flash("message", { type: "success", title: "Success", text: "The doctor was deleted successfully." })
			return res.redirect("/admin/viewdoctors");
		} catch (err) {
			console.log("adddoctor Error: ", err)
			req.flash("message", { type: "danger", title: "Add Doctor Error", text: "Ensure all the fields are filled correctly." })
			return res.redirect("/admin/viewdoctors");
		}
	});
}