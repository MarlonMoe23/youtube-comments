let commentsData = null;
let currentSortColumn = null;
let isAscending = true;

// Determinar la URL base según el entorno
const baseUrl = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000' 
    : '';

function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (years > 0) return `hace ${years} año${years > 1 ? 's' : ''}`;
    if (months > 0) return `hace ${months} mes${months > 1 ? 'es' : ''}`;
    if (days > 0) return `hace ${days} día${days > 1 ? 's' : ''}`;
    if (hours > 0) return `hace ${hours} hora${hours > 1 ? 's' : ''}`;
    if (minutes > 0) return `hace ${minutes} minuto${minutes > 1 ? 's' : ''}`;
    return `hace ${seconds} segundo${seconds > 1 ? 's' : ''}`;
}

function updateStats(data) {
    const totalComments = data.length;
    const replies = data.filter(comment => comment.EsRespuesta === 'Sí').length;
    const mainComments = totalComments - replies;
    const totalLikes = data.reduce((sum, comment) => sum + parseInt(comment.Likes || 0), 0);

    return `
        <div class="stats-container">
            <div class="stat-box">
                <div class="stat-number">${totalComments}</div>
                <div class="stat-label">Total Comentarios</div>
            </div>
            <div class="stat-box">
                <div class="stat-number">${mainComments}</div>
                <div class="stat-label">Comentarios Principales</div>
            </div>
            <div class="stat-box">
                <div class="stat-number">${replies}</div>
                <div class="stat-label">Respuestas</div>
            </div>
            <div class="stat-box">
                <div class="stat-number">${totalLikes}</div>
                <div class="stat-label">Total Likes</div>
            </div>
        </div>
    `;
}

document.getElementById('submit-button').addEventListener('click', async () => {
    const url = document.getElementById('youtube-url').value;
    const outputDiv = document.getElementById('output-div');
    const downloadButton = document.getElementById('download-button');
    const loadingSpinner = document.querySelector('.loading-spinner');

    if (!url) {
        outputDiv.innerHTML = '<div class="error-message">Por favor, ingresa una URL de YouTube</div>';
        return;
    }

    try {
        console.log('Enviando solicitud para URL:', url);
        loadingSpinner.style.display = 'block';
        outputDiv.innerHTML = '';
        downloadButton.style.display = 'none';

        const response = await fetch(`${baseUrl}/api/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ url })
        });

        console.log('Respuesta recibida:', response.status);
        
        // Agregar este bloque para debug
        const responseText = await response.text();
        console.log('Respuesta texto:', responseText);
        
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            throw new Error(`Error al parsear JSON: ${responseText}`);
        }

        if (response.ok) {
            commentsData = data;
            outputDiv.innerHTML = updateStats(data) + createTable(data);
            downloadButton.style.display = 'inline-block';
            addSortListeners();
        } else {
            outputDiv.innerHTML = `
                <div class="error-message">
                    Error: ${data.error || 'Error desconocido'}
                    ${data.details ? `<br>Detalles: ${data.details}` : ''}
                </div>`;
        }
    } catch (error) {
        console.error('Error completo:', error);
        outputDiv.innerHTML = `
            <div class="error-message">
                Error al procesar la solicitud<br>
                Detalles: ${error.message || 'Error desconocido'}
            </div>`;
    } finally {
        loadingSpinner.style.display = 'none';
    }
});

document.getElementById('download-button').addEventListener('click', () => {
    if (commentsData) {
        const worksheet = XLSX.utils.json_to_sheet(commentsData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Comentarios');
        XLSX.writeFile(workbook, 'youtube_comments.xlsx');
    }
});

function sortData(data, column, ascending) {
    return [...data].sort((a, b) => {
        let valueA = a[column];
        let valueB = b[column];

        if (column === 'Likes') {
            valueA = parseInt(valueA) || 0;
            valueB = parseInt(valueB) || 0;
        }
        else if (column === 'PublicadoEn') {
            valueA = new Date(valueA);
            valueB = new Date(valueB);
        }
        else {
            valueA = valueA.toLowerCase();
            valueB = valueB.toLowerCase();
        }

        if (valueA < valueB) return ascending ? -1 : 1;
        if (valueA > valueB) return ascending ? 1 : -1;
        return 0;
    });
}

function addSortListeners() {
    const headers = document.querySelectorAll('.sortable');
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const column = header.getAttribute('data-column');
            
            headers.forEach(h => {
                if (h !== header) {
                    h.classList.remove('asc', 'desc');
                }
            });

            if (currentSortColumn === column) {
                isAscending = !isAscending;
                header.classList.toggle('asc', isAscending);
                header.classList.toggle('desc', !isAscending);
            } else {
                currentSortColumn = column;
                isAscending = true;
                header.classList.add('asc');
                header.classList.remove('desc');
            }

            commentsData = sortData(commentsData, column, isAscending);
            updateTableBody(commentsData);
        });
    });
}

function updateTableBody(data) {
    const tbody = document.querySelector('.responsive-table tbody');
    tbody.innerHTML = data.map(row => createTableRow(row)).join('');
}

function createTableRow(row) {
    const isReply = row.EsRespuesta === 'Sí';
    const rowClass = isReply ? 'reply-comment' : '';
    const badge = isReply ? '<span class="author-badge reply-badge">Respuesta</span>' : '';
    const dateAgo = `<span class="date-ago">${timeAgo(row.PublicadoEn)}</span>`;

    return `
        <tr class="${rowClass}">
            <td data-label="Autor">
                ${row.Autor}
                ${badge}
            </td>
            <td data-label="Comentario">${row.Comentario}</td>
            <td data-label="Likes">${row.Likes}</td>
            <td data-label="Publicado en">
                ${row.PublicadoEn}
                ${dateAgo}
            </td>
        </tr>
    `;
}

function createTable(data) {
    return `
        <div class="responsive-table-container">
            <table class="responsive-table">
                <thead>
                    <tr>
                        <th class="sortable" data-column="Autor">Autor</th>
                        <th class="sortable" data-column="Comentario">Comentario</th>
                        <th class="sortable" data-column="Likes">Likes</th>
                        <th class="sortable" data-column="PublicadoEn">Publicado en</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map(row => createTableRow(row)).join('')}
                </tbody>
            </table>
        </div>
    `;
}