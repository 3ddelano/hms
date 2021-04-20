// Hospital Management System
// CSE2004 Project 2021
// Vellore Institute of Technology, Chennai

let isDebug = true;
if (process.env.PORT) isDebug = false;
else require("dotenv").config({ path: __dirname + "/.env" });

const express = require("express");
const flash = require("express-flash");
const session = require("express-session");

const passport = require("passport");
const { initializePassport } = require("./passport-config");
initializePassport(passport);

const app = express();
const port = process.env.PORT || 8082;



// database function
const { init, getHospitalByName } = require("./database.js");

// other routes
let patientRoutes = require("./patientRoutes");

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(flash());

if (process.env.NODE_ENV == 'production') {
	app.use((req, res, next) => {
		if (req.headers['x-forwarded-proto'] !== 'https') {
			return res.redirect(['https://', req.get('Host'), req.url].join(''));
		}
		return next();
	});
}

app.use(session({
	secret: process.env.SESSION_SECRET,
	resave: false,
	saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

Object.defineProperty(String.prototype, "toProperCase", {
	value: function () {
		return this.replace(/([^\W_]+[^\s-]*) */g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
	}
});



const renderTemplate = async (req, res, template, data = {}) => {
	let hospital = await getHospitalByName('City Hospital');
	const baseData = {
		path: req.path || null,
		user: req.isAuthenticated() ? req.user : null,
		hospital
	};
	console.log(hospital)
	return res.render(template, Object.assign(baseData, data));
};

//main landing page
app.get("/", (req, res) => {
	renderTemplate(req, res, "pages/index");
});

patientRoutes(app, passport, renderTemplate);


// handle 404
app.get("/404", (req, res) => {
	renderTemplate(req, res, "pages/404");
});

app.get("/about", (req, res) => {
	renderTemplate(req, res, "pages/about");
});

app.get("*", (req, res) => {
	return res.redirect("/404");
});

app.listen(port, () => {
	if (isDebug) console.log(`Project running on http://localhost:${port}`);
	else console.log("Project running on https://hms-product.herokuapp.com");
});

// Connecting to database

if (process.env.DATABASE_URL) {
	init();
} else {
	throw new Error("No database URL provided in env.");
}
