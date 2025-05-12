const { google } = require('googleapis');
require('dotenv').config();

// Función para extraer el ID del video
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

module.exports = async (req, res) => {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // Manejar preflight request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Verificar método
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    try {
        // Verificar API KEY
        if (!process.env.YOUTUBE_API_KEY) {
            throw new Error('YouTube API Key no configurada');
        }

        const youtube = google.youtube({
            version: 'v3',
            auth: process.env.YOUTUBE_API_KEY
        });

        // Verificar body de la request
        if (!req.body || !req.body.url) {
            return res.status(400).json({ error: 'URL no proporcionada' });
        }

        const videoId = extractVideoId(req.body.url);
        if (!videoId) {
            return res.status(400).json({ error: 'URL de YouTube inválida' });
        }

        const comments = [];
        let nextPageToken = null;

        do {
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
        } while (nextPageToken);

        return res.status(200).json(comments);

    } catch (error) {
        console.error('Error en el servidor:', error);
        return res.status(500).json({ 
            error: 'Error al procesar la solicitud',
            details: error.message
        });
    }
};