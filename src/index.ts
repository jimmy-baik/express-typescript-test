import express from 'express';
import fs from 'node:fs';
import path from 'node:path'

const app = express();
const port = 3002;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.get('/', (req, res) => {
    res.send("Hello!");
});

app.get('/params-example/:userSuppliedParameter', (req,res) => {
    const params = req.params;
    res.send(params);
});

app.listen(port);

