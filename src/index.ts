import express from 'express';
import fs from 'node:fs';

const app = express();
const port = 3002;


app.get('/', (req, res) => {
    res.send("Hello!");
});

app.get('/params-example/:userSuppliedParameter', (req,res) => {
    const params = req.params;
    res.send(params);
});

app.listen(port);

