// Hospital Management System
// CSE2004 Project 2021
// Vellore Institute of Technology, Chennai

const express = require('express');
const app = express()
const port = 3000

app.set('view engine', 'ejs');

app.get('/', function (req, res) {
    res.render('pages/index');
});


app.listen(8080);
console.log('8080 is the magic port');

app.listen(port, () => {
    console.log(`Project running on http://localhost:${port}`)
})