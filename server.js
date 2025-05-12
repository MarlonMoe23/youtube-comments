const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const DEBUG = true; // Activar/desactivar logs de debugging

// Verificar API KEY al inicio
if (!process.env.YOUTUBE_API_KEY) {
    console.error('ERROR: No se encontró la API KEY de YouTube. Asegúrate de tener un archivo .env con YOUTUBE_API_KEY=tu_api_key');
    process.exit(1);
}

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Middleware para logging
app.use((req, res, next) => {
    if (DEBUG) {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
        if (req.body) console.log('Body:', req.body);
    }
    next();
});

const youtube = google.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_API_KEY
});

function extractVideoId(url) {
    try {
        const patterns = [
            /(?:youtu\.be\/|youtube\.com\/watch\?v=)([^?&]+)/,
            /v=([^&]+)/
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    } catch (error) {
        console.error('Error al extraer video ID:', error);
        return null;
    }
}

app.post('/api/comments', async (req, res) => {
    if (DEBUG) {
        console.log('\n--- Nueva solicitud de comentarios ---');
        console.log('API KEY presente:', !!process.env.YOUTUBE_API_KEY);
        console.log('URL recibida:', req.body.url);
    }

    try {
        console.log('Recibiendo solicitud para URL:', req.body.url);
        
        const { url } = req.body;
        if (!url) {
            return res.status(400).json({ error: 'URL no proporcionada' });
        }

        const videoId = extractVideoId(url);
        console.log('Video ID extraído:', videoId);
        
        if (!videoId) {
            return res.status(400).json({ error: 'URL de YouTube inválida' });
        }

        const comments = [];
        let nextPageToken = null;

        do {
            try {
                console.log('Obteniendo comentarios, página:', nextPageToken || 'inicial');
                
                const response = await youtube.commentThreads.list({
                    part: ['snippet', 'replies'],
                    videoId: videoId,
                    maxResults: 100,
                    pageToken: nextPageToken
                });

                for (const item of response.data.items) {
                    const topComment = item.snippet.topLevelComment.snippet;
                    comments.push({
                        Autor: topComment.authorDisplayName,
                        Comentario: topComment.textDisplay,
                        Likes: topComment.likeCount,
                        PublicadoEn: topComment.publishedAt,
                        EsRespuesta: 'No'
                    });

                    if (item.replies) {
                        for (const reply of item.replies.comments) {
                            comments.push({
                                Autor: reply.snippet.authorDisplayName,
                                Comentario: reply.snippet.textDisplay,
                                Likes: reply.snippet.likeCount,
                                PublicadoEn: reply.snippet.publishedAt,
                                EsRespuesta: 'Sí'
                            });
                        }
                    }
                }

                nextPageToken = response.data.nextPageToken;
                console.log('Comentarios obtenidos en esta página:', response.data.items.length);
                
            } catch (error) {
                console.error('Error al obtener comentarios:', error.response?.data || error);
                throw new Error('Error al obtener comentarios de YouTube');
            }
        } while (nextPageToken);

        console.log('Total de comentarios obtenidos:', comments.length);
        res.json(comments);

    } catch (error) {
        console.error('Error en el servidor:', error);
        res.status(500).json({ 
            error: 'Error al procesar la solicitud',
            details: error.message
        });
    }
});

app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
    console.log('API KEY configurada:', process.env.YOUTUBE_API_KEY ? 'SÍ' : 'NO');
});