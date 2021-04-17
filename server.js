// Hospital Management System
// CSE2004 Project 2021
// Vellore Institute of Technology, Chennai

const express = require('express');

const app = express();
const port = process.env.PORT || 3000;

let isDebug;
if (process.env.PORT) isDebug = false;
else isDebug = true;

app.set('view engine', 'ejs');

app.get('/', (_req, res) => {
    res.render('pages/index');
});

app.listen(port, () => {
    if (isDebug) console.log(`Project running on http://localhost:${port}`);
    else console.log('Project running on https://hms-product.herokuapp.com');
});
