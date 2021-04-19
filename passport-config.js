const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcrypt");

const { getPatientByID } = require("./database.js");
exports.initializePassport = async (passport) => {

    const authenticateUser = async (email, password, done) => {
        let patient = await getPatientByID(email);

        if (patient == null) return done(null, false, { message: "Email and password combination do not exist." });

        try {
            if (await bcrypt.compare(password, patient.password)) {
                return done(null, patient);
            } else return done(null, false, { message: "Email and password combination do not exist." })
        } catch (err) {
            return done(err);
        }
    };

    passport.use(new LocalStrategy({ usernameField: "email" }, authenticateUser));
    passport.serializeUser((user, done) => done(null, user.id));
    passport.deserializeUser(async (id, done) => {
        let gotUser = await getPatientByID(id);
        return done(null, gotUser);
    });
}