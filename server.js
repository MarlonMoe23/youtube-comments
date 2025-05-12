const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Configurar CORS
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Servir archivos estáticos desde el directorio actual

const youtube = google.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_API_KEY
});

async function getVideoComments(videoId) {
    // ... (mantén el resto de tu código igual)
}

app.post('/api/comments', async (req, res) => {
    try {
        const { url } = req.body;
        console.log('URL recibida:', url);

        // Extraer el ID del video
        const videoId = extractVideoId(url);
        if (!videoId) {
            return res.status(400).json({ 
                error: 'URL inválida',
                details: 'No se pudo extraer el ID del video de la URL proporcionada'
            });
        }

        const comments = await getVideoComments(videoId);
        res.json(comments);

    } catch (error) {
        console.error('Error completo:', error);
        res.status(500).json({ 
            error: 'Error al procesar la solicitud',
            details: error.message
        });
    }
});

function extractVideoId(url) {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : null;
}

// Para Vercel, necesitamos exportar la app
module.exports = app;

// Solo escuchar en puerto si no estamos en Vercel
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Servidor corriendo en puerto ${PORT}`);
    });
}