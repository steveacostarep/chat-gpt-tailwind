const express = require('express');
const { OpenAI } = require('openai');
const axios = require('axios');
const fs = require('fs');
const pdf = require('pdf-parse');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Inicializa OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Procesa el archivo PDF y guarda el contenido
let dataBuffer = fs.readFileSync(path.join(__dirname, '../tailwind_pdf.pdf'));
let contentFromPdf = '';

pdf(dataBuffer).then(function(data) {
    contentFromPdf = data.text;
});

// Función para obtener la documentación desde la API de Tailwind
async function getTailwindDocumentation() {
    try {
        const response = await axios.get('https://tailwind-api.up.railway.app/documentacion');
        return response.data.contenido;  // Suponiendo que el contenido está en esta propiedad
    } catch (error) {
        console.error('Error al obtener la documentación de Tailwind desde la API:', error);
        return '';  // En caso de error, retornar cadena vacía
    }
}

// Función para filtrar el contenido según el prompt del usuario
async function filterContentForPrompt(content, prompt) {
    return content.split('\n')
                  .filter(line => line.toLowerCase().includes(prompt.toLowerCase()))
                  .join('\n');
}

// Ruta para procesar el prompt del usuario y generar el componente Tailwind
app.post('/api/generate', async (req, res) => {
    const userPrompt = req.body.prompt;

    try {
        // 1. Obtener la documentación desde la API de Tailwind
        const tailwindContent = await getTailwindDocumentation();

        // 2. Filtrar el contenido de la API y del PDF basado en el prompt del usuario
        const filteredApiContent = await filterContentForPrompt(tailwindContent, userPrompt);
        const filteredPdfContent = await filterContentForPrompt(contentFromPdf, userPrompt);

        // 3. Crear un prompt final combinando la información de la API y del PDF
        const finalPromptContent = `Información de la API:\n${filteredApiContent}\n\nInformación del PDF:\n${filteredPdfContent}`;

        // 4. Pasar el prompt filtrado al chatbot de OpenAI para generar el componente Tailwind
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            temperature: 0, // Temperatura a 0 para mayor precisión
            messages: [
                { role: "system", content: "Solo responde con el código del componente Tailwind CSS, sin ninguna explicación adicional." },
                { role: "user", content: finalPromptContent }
            ],
        });

        // 5. Devolver solo el componente generado al usuario
        res.json({ result: response.choices[0].message.content });
    } catch (error) {
        console.error('Error al generar el componente Tailwind:', error);
        res.status(500).json({ error: 'Error al generar el componente' });
    }
});


// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor corriendo en el puerto ${port}`);
});
