# Video del flujo de Amparito — alternativas a HyperFrames

En Amparito ya quedó embebido un explainer animado (componente `FlowVideo`) que se reproduce solo al entregar la póliza. Si además quieres un video/animación **standalone** (para slides, redes o el pitch), aquí van dos caminos.

---

## Opción A — Prompt para Claude Design (ejecutar con Fable)

Pega este prompt en Claude Design. Genera una animación web autoejecutable que puedes grabar en pantalla y exportar a MP4.

```
Crea una animación web autoejecutable (un explainer tipo motion graphic), SIN audio, SOLO con subtítulos en español de Colombia, en formato horizontal 16:9. Debe durar unos 26 segundos y reproducirse en bucle con un botón de "reproducir de nuevo".

Identidad visual estilo Colsubsidio: amarillo #FFD100, azul #0B62B4, texto negro/gris oscuro, fondos blanco y amarillo, tipografía bold moderna (Poppins). Transiciones suaves entre escenas, una barra de progreso arriba y un indicador de paso (1 a 7).

Título de apertura: "Amparito — ¿qué acaba de pasar?" con subtítulo "La ruta que seguiste para quedar asegurado, en segundos."

Una escena por paso (ícono grande + título corto + subtítulo), en este orden:
1. Entras a Amparito — "Le contaste qué cambió en tu vida." (ícono: burbuja de chat)
2. La IA analiza tu situación — "Entendió lo que realmente necesitas." (ícono: cerebro + engranaje)
3. Te muestra opciones — "Con una RECOMENDADA para ti y su porqué." (ícono: tarjetas, una con estrella)
4. Eliges la que te conviene — "Tú decides, sin presión." (ícono: cursor/clic)
5. Llenas tus datos — "Un formulario rápido, con tu autorización (Ley 1581)." (ícono: formulario)
6. Se transmite de forma segura — "Tus datos viajan cifrados a la API del seguro y del banco." (ícono: candado + dos flechas hacia dos servidores)
7. Recibes tu póliza — "Tu certificado llega a tu correo en pocas horas." (ícono: documento con check verde)

Escena de cierre: mensaje grande "Del \"no sé qué necesito\" al \"ya quedé asegurado\"." y debajo, más pequeño: "Amparito · Colsubsidio · 24/7, sin esperas."

Sin voz ni música: solo texto y subtítulos en pantalla. Entrega el código listo para ver en el navegador.
```

Para exportar a MP4: abre la animación en el navegador y grábala con cualquier grabador de pantalla (o pásame el HTML que genere y yo lo renderizo a MP4).

---

## Opción B — Figma / FigJam

Guion por frames (uno por escena, 16:9), mismo contenido y paleta que arriba. En Figma:
1. Crea 9 frames (intro + 7 pasos + cierre) con el ícono, título y subtítulo de cada escena.
2. Usa "Smart animate" entre frames para las transiciones, con la marca Colsubsidio (amarillo #FFD100 / azul #0B62B4, Poppins).
3. Exporta como prototipo y grábalo, o usa un plugin de export a video/GIF.

Si me pasas el archivo Figma (o el link), puedo ayudarte a estructurar los frames o convertir el resultado.

---

## Nota

El explainer que ya quedó dentro de Amparito cubre el objetivo del demo (se muestra solo al entregar la póliza). Estas opciones son para tener además una pieza suelta compartible.
