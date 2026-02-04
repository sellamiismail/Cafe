const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const pg = require('pg');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const port = 5050;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// Serve static files from the project `file` folder (contains index.html, style.css, script.js)
app.use(express.static(path.join(__dirname,  'file')));

require('dotenv').config();
const databaze = process.env.DATABAZE;
const client = new pg.Client(databaze)
// create HTTP server and attach socket.io
const httpServer = http.createServer(app);
const io = new Server(httpServer);

io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);
    socket.on('client-new-order', (payload) => {
        try { io.emit('new-order', payload); } catch (e) {}
    });
    socket.on('disconnect', () => {
        console.log('Socket disconnected:', socket.id);
    });
});

async function startServer() {
    try {
        await client.connect(); 
        console.log('Connected to database');
    } catch (err) {
        console.warn('Database connection failed — starting server anyway:', err && err.message ? err.message : err);
    }

    // start HTTP server (socket.io attached)
    httpServer.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
}

startServer();
app.get('/', getfile);
    function getfile(req, res) {
        res.sendFile(path.join(__dirname,  'file','html','index.html'));
    };

// minimal login route for React dev proxy
app.get('/getdata',getdata);
async function getdata(req, res) {
    const query = 'SELECT * FROM categorie';
    client.query(query).then(function(result){
        res.json(result.rows);
    })
}
app.get("/product",product)
function product(req,res){
   const query = 'SELECT * FROM product';
       client.query(query).then(function(result){
        res.json(result.rows);
    })
}

app.post('/demander', async function demander(req, res) {
    console.log('Received /demander request with body:', req.body);
    
    const payload = req.body || {};
    console.log(payload)
    const numtable = 10;
    const items = Array.isArray(payload.items) ? payload.items : [];
    const totale = payload.totale;

    if (!items.length) {
        return res.status(400).json({ success: false, error: 'EMPTY_CART' });
    }
    if (totale === undefined || totale === null || Number.isNaN(Number(totale))) {
        return res.status(400).json({ success: false, error: 'INVALID_TOTAL' });
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 8);

    let idrecu;

    try {
        await client.query('BEGIN');

        const verifyTable = await client.query(
            'SELECT idrecu FROM recu WHERE id=$1 AND heurf IS NULL',
            [numtable]
        );

        if (verifyTable.rowCount === 0) {
            const recuInsert = await client.query(
                'INSERT INTO recu (id, totale, date, heurd, heurf) VALUES ($1,$2,$3,$4,$5) RETURNING idrecu',
                [numtable, Number(totale), dateStr, timeStr, null]
            );
            idrecu = recuInsert.rows[0].idrecu;

            await client.query(
                'UPDATE tablee SET type=$1, idrecu=$2 WHERE id=$3',
                ['occupied', idrecu, numtable]
            );
        } else {
            idrecu = verifyTable.rows[0].idrecu;
        }

        for (const item of items) {
            await client.query(
                'INSERT INTO orderr (idrecu, id, idname, optionn) VALUES ($1,$2,$3,$4)',
                [idrecu, numtable, String(item.idname), item.optionn ?? null]
            );
        }

        await client.query('COMMIT');

        io.emit('new-order', {
            idrecu,
            numtable,
            totale: Number(totale),
            items,
            timestamp: Date.now()
        });

        return res.json({ success: true, idrecu });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        return res.status(500).json({ success: false, error: 'SERVER_ERROR' });
    }
});


//12 add sortie-auto endpoint
