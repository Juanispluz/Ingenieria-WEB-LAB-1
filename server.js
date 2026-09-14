const http = require('http');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

// Abrir o crear la base de datos del hotel
const db = new DatabaseSync('hotel.db');

// Tabla de la entidad principal: los huéspedes
db.exec(`
    CREATE TABLE IF NOT EXISTS huespedes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        correo TEXT NOT NULL,
        telefono TEXT NOT NULL
    )
`);

// Tabla de las operaciones: las reservas
db.exec(`
    CREATE TABLE IF NOT EXISTS reservas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        huesped_id INTEGER NOT NULL,
        fecha_ingreso TEXT NOT NULL,
        noches INTEGER NOT NULL,
        personas INTEGER NOT NULL
    )
`);

// Las sentencias se preparan una sola vez, fuera del servidor
const insertarHuesped = db.prepare(`
    INSERT INTO huespedes (nombre, correo, telefono)
    VALUES (?, ?, ?)
`);

const insertarReserva = db.prepare(`
    INSERT INTO reservas (huesped_id, fecha_ingreso, noches, personas)
    VALUES (?, ?, ?, ?)
`);

const buscarHuesped = db.prepare(`
    SELECT id FROM huespedes WHERE id = ?
`);

// Encabezados que se repiten en casi todas las respuestas
const tipoHtml = { 'Content-Type': 'text/html; charset=UTF-8' };

// Arma una página de respuesta para no repetir el mismo HTML
function pagina(titulo, contenido) {
    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${titulo} - Hotel Las Palmas</title>
    <link rel="stylesheet" href="/styles.css">
</head>
<body>
    <header>
        <h1>Hotel Las Palmas</h1>
        <p>${titulo}</p>
    </header>
    <nav>
        <a href="/">Inicio</a>
        <a href="/acerca">Acerca de</a>
        <a href="/registro">Registro</a>
        <a href="/servicios">Servicios</a>
    </nav>
    <main>
        <section>
            ${contenido}
        </section>
    </main>
    <footer>
        <p>Hotel Las Palmas &middot; Ingeniería Web &middot; Universidad Cooperativa de Colombia</p>
    </footer>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
    console.log('Método:', req.method);
    console.log('URL:', req.url);

    if (req.method === 'GET' && req.url === '/') {
        const html = fs.readFileSync('index.html');

        res.writeHead(200, tipoHtml);

        return res.end(html);
    }

    else if (req.method === 'GET' && req.url === '/acerca') {
        const html = fs.readFileSync('acerca.html');

        res.writeHead(200, tipoHtml);

        return res.end(html);
    }

    else if (req.method === 'GET' && req.url === '/registro') {
        const html = fs.readFileSync('registro.html');

        res.writeHead(200, tipoHtml);

        return res.end(html);
    }

    else if (req.method === 'GET' && req.url === '/servicios') {
        const html = fs.readFileSync('servicios.html');

        res.writeHead(200, tipoHtml);

        return res.end(html);
    }

    else if (req.method === 'GET' && req.url === '/styles.css') {
        const css = fs.readFileSync('styles.css');

        res.writeHead(200, {
            'Content-Type': 'text/css; charset=UTF-8'
        });

        return res.end(css);
    }

    // Primer formulario: registrar al huésped
    else if (req.method === 'POST' && req.url === '/huespedes') {
        let cuerpo = '';

        req.on('data', fragmento => {
            cuerpo += fragmento.toString();
        });

        req.on('end', () => {
            const datos = new URLSearchParams(cuerpo);

            const nombre = datos.get('nombre')?.trim();
            const correo = datos.get('correo')?.trim();
            const telefono = datos.get('telefono')?.trim();

            console.log('Nombre:', nombre);
            console.log('Correo:', correo);
            console.log('Teléfono:', telefono);

            if (!nombre || !correo || !telefono) {
                res.writeHead(400, tipoHtml);

                return res.end(pagina('Datos incompletos', `
                    <h2>Faltan datos</h2>
                    <p>El nombre, el correo y el teléfono son obligatorios.</p>
                    <p><a href="/registro">Volver al registro</a></p>
                `));
            }

            try {
                const resultado = insertarHuesped.run(
                    nombre,
                    correo,
                    telefono
                );

                console.log(
                    'Huésped almacenado con id:',
                    resultado.lastInsertRowid
                );

                res.writeHead(201, tipoHtml);

                return res.end(pagina('Registro completado', `
                    <h2>Registro completado</h2>
                    <p>Sus datos quedaron guardados, ${nombre}.</p>
                    <p class="destacado">
                        Su número de huésped es:
                        <strong>${resultado.lastInsertRowid}</strong>
                    </p>
                    <p>
                        Anote ese número, porque se necesita para pedir la
                        reserva.
                    </p>
                    <p><a href="/servicios">Ir a solicitar la reserva</a></p>
                `));
            }

            catch (error) {
                console.error('Error al guardar el huésped:', error);

                res.writeHead(500, tipoHtml);

                return res.end(pagina('Error interno', `
                    <h2>Error interno</h2>
                    <p>No fue posible guardar el registro.</p>
                    <p><a href="/registro">Volver al registro</a></p>
                `));
            }
        });

        return;
    }

    // Segundo formulario: registrar la reserva del huésped
    else if (req.method === 'POST' && req.url === '/reservas') {
        let cuerpo = '';

        req.on('data', fragmento => {
            cuerpo += fragmento.toString();
        });

        req.on('end', () => {
            const datos = new URLSearchParams(cuerpo);

            const huespedId = datos.get('huesped_id')?.trim();
            const fechaIngreso = datos.get('fecha_ingreso')?.trim();
            const noches = datos.get('noches')?.trim();
            const personas = datos.get('personas')?.trim();

            console.log('Huésped:', huespedId);
            console.log('Fecha de ingreso:', fechaIngreso);
            console.log('Noches:', noches);
            console.log('Personas:', personas);

            if (!huespedId || !fechaIngreso || !noches || !personas) {
                res.writeHead(400, tipoHtml);

                return res.end(pagina('Datos incompletos', `
                    <h2>Faltan datos</h2>
                    <p>Todos los campos de la reserva son obligatorios.</p>
                    <p><a href="/servicios">Volver a servicios</a></p>
                `));
            }

            // Los tres campos numéricos se convierten para validarlos
            const idNumero = Number(huespedId);
            const nochesNumero = Number(noches);
            const personasNumero = Number(personas);

            if (
                !Number.isInteger(idNumero) || idNumero < 1 ||
                !Number.isInteger(nochesNumero) || nochesNumero < 1 ||
                !Number.isInteger(personasNumero) || personasNumero < 1
            ) {
                res.writeHead(400, tipoHtml);

                return res.end(pagina('Datos incorrectos', `
                    <h2>Datos incorrectos</h2>
                    <p>
                        El número de huésped, las noches y las personas deben
                        ser números enteros mayores que cero.
                    </p>
                    <p><a href="/servicios">Volver a servicios</a></p>
                `));
            }

            try {
                // Se comprueba que el huésped exista antes de reservar
                const huesped = buscarHuesped.get(idNumero);

                if (!huesped) {
                    res.writeHead(400, tipoHtml);

                    return res.end(pagina('Huésped no encontrado', `
                        <h2>Huésped no encontrado</h2>
                        <p>
                            No existe un huésped con el número
                            ${idNumero}. Debe registrarse primero.
                        </p>
                        <p><a href="/registro">Ir al registro</a></p>
                    `));
                }

                const resultado = insertarReserva.run(
                    idNumero,
                    fechaIngreso,
                    nochesNumero,
                    personasNumero
                );

                console.log(
                    'Reserva almacenada con id:',
                    resultado.lastInsertRowid
                );

                res.writeHead(201, tipoHtml);

                return res.end(pagina('Reserva registrada', `
                    <h2>Reserva registrada</h2>
                    <p>La reserva quedó guardada con estos datos:</p>
                    <ul>
                        <li>Número de reserva: ${resultado.lastInsertRowid}</li>
                        <li>Número de huésped: ${idNumero}</li>
                        <li>Fecha de ingreso: ${fechaIngreso}</li>
                        <li>Noches: ${nochesNumero}</li>
                        <li>Personas: ${personasNumero}</li>
                    </ul>
                    <p><a href="/servicios">Registrar otra reserva</a></p>
                `));
            }

            catch (error) {
                console.error('Error al guardar la reserva:', error);

                res.writeHead(500, tipoHtml);

                return res.end(pagina('Error interno', `
                    <h2>Error interno</h2>
                    <p>No fue posible guardar la reserva.</p>
                    <p><a href="/servicios">Volver a servicios</a></p>
                `));
            }
        });

        return;
    }

    else {
        res.writeHead(404, tipoHtml);

        return res.end(pagina('Página no encontrada', `
            <h2>404 - Página no encontrada</h2>
            <p>La dirección solicitada no existe en este sitio.</p>
            <p><a href="/">Volver al inicio</a></p>
        `));
    }
});

server.listen(3000, () => {
    console.log('Servidor disponible en http://localhost:3000');
});
