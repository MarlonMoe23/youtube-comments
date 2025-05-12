const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Configurar CORS
app.use(cors());
app.use(express.json());

// Servir archivos estáticos
app.use(express.static(path.join(__dirname)));

// Asegurarse de que todas las rutas no-API sirvan index.html
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, 'index.html'));
    }
});

const youtube = google.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_API_KEY
});

async function getVideoComments(videoId) {
    const comments = [];
    let nextPageToken = '';

    try {
        do {
            const response = await youtube.commentThreads.list({
                part: ['snippet', 'replies'],
                videoId: videoId,
                maxResults: 100,
                pageToken: nextPageToken || ''
            });

            const items = response.data.items;
            
            for (const item of items) {
                const comment = item.snippet.topLevelComment.snippet;
                comments.push({
                    Autor: comment.authorDisplayName,
                    Comentario: comment.textDisplay,
                    Likes: comment.likeCount,
                    PublicadoEn: comment.publishedAt,
                    EsRespuesta: 'No'
                });

                // Procesar respuestas si existen
                if (item.replies) {
                    item.replies.comments.forEach(reply => {
                        comments.push({
                            Autor: reply.snippet.authorDisplayName,
                            Comentario: reply.snippet.textDisplay,
                            Likes: reply.snippet.likeCount,
                            PublicadoEn: reply.snippet.publishedAt,
                            EsRespuesta: 'Sí'
                        });
                    });
                }
            }

            nextPageToken = response.data.nextPageToken;
        } while (nextPageToken);

        return comments;

    } catch (error) {
        throw new Error(`Error al obtener comentarios: ${error.message}`);
    }
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

// Exportar la app para Vercel
module.exports = app;

// Iniciar el servidor solo en desarrollo
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Servidor corriendo en puerto ${PORT}`);
    });
}