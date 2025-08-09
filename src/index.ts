import express from 'express';
import { xss } from 'express-xss-sanitizer';
import path from 'node:path'
import { fileURLToPath } from 'node:url';

const app = express();
const port = 3002;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(xss());


app.get('/', (req, res) => {
    res.send("Hello!");
});

app.get('/params-example/:userSuppliedParameter', (req,res) => {
    let paramsString = '';
    for (let [k, v] of Object.entries(req.params)) {
        paramsString += String(k) + ':' + String(v);
    }
    res.render('index', {title: 'Params Example', body: paramsString});
});


app.listen(port);
