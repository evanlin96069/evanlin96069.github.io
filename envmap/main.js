let images = {};

function uploadImage(side) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = handleFileUpload(side);

    input.click();
}

function handleFileUpload(side) {
    return (e) => {
        const file = e.target.files[0];
        handleImage(side, file);
    };
}

function handleImage(side, file) {
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = document.getElementById(side);
            img.style.backgroundImage = `url(${event.target.result})`;
            images[side] = event.target.result;
        };
        reader.readAsDataURL(file);
    }
}

function allowDrop(event) {
    event.preventDefault();
}

function handleDrop(side, event) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    handleImage(side, file);
}

function generateEnvmap() {
    if (Object.keys(images).length !== 6) {
        alert('Please upload images for all sides.');
        return;
    }

    const zip = new JSZip();
    const imagePromises = [];

    Object.keys(images).forEach((side, index) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        const imagePromise = new Promise((resolve) => {
            img.onload = () => {
                canvas.width = img.height;
                canvas.height = img.width;

                let image_index = 0;


                switch (side) {
                    case 'right':
                        image_index = 0;
                        // Flip the image horizontally​
                        ctx.translate(canvas.width, 0);
                        ctx.scale(-1, 1);
                        // Rotate the image 90° counter-clockwise​
                        ctx.translate(canvas.width / 2, canvas.height / 2);
                        ctx.rotate((90 * Math.PI) / 180);
                        ctx.translate(-canvas.width / 2, -canvas.height / 2);
                        break;
                    case 'left':
                        image_index = 1;
                        // Flip the image horizontally​
                        ctx.translate(canvas.width, 0);
                        ctx.scale(-1, 1);
                        // Rotate the image 90° clockwise​
                        ctx.translate(canvas.width / 2, canvas.height / 2);
                        ctx.rotate((-90 * Math.PI) / 180);
                        ctx.translate(-canvas.width / 2, -canvas.height / 2);
                        break;
                    case 'back':
                        image_index = 2;
                        // Flip the image vertically​
                        ctx.translate(0, canvas.height);
                        ctx.scale(1, -1);
                        break;
                    case 'front':
                        image_index = 3;
                        // Flip the image horizontally​
                        ctx.translate(canvas.width, 0);
                        ctx.scale(-1, 1);
                        break;
                    case 'up':
                        image_index = 4;
                        // Flip the image horizontally​
                        ctx.translate(canvas.width, 0);
                        ctx.scale(-1, 1);
                        // Rotate the image 90° counter-clockwise​
                        ctx.translate(canvas.width / 2, canvas.height / 2);
                        ctx.rotate((90 * Math.PI) / 180);
                        ctx.translate(-canvas.width / 2, -canvas.height / 2);
                        break;
                    case 'down':
                        image_index = 5;
                        // Flip the image horizontally​
                        ctx.translate(canvas.width, 0);
                        ctx.scale(-1, 1);
                        // Rotate the image 90° counter-clockwise​
                        ctx.translate(canvas.width / 2, canvas.height / 2);
                        ctx.rotate((90 * Math.PI) / 180);
                        ctx.translate(-canvas.width / 2, -canvas.height / 2);
                        break;
                    default:
                        break;
                }

                ctx.drawImage(img, 0, 0);

                const imageDataUrl = canvas.toDataURL('image/png');
                zip.file(`envmap_${image_index}.png`, imageDataUrl.split('base64,')[1], { base64: true });
                resolve();
            };
        });

        img.src = images[side];
        imagePromises.push(imagePromise);
    });

    Promise.all(imagePromises).then(() => {
        zip.generateAsync({ type: 'blob' })
            .then((content) => {
                // Create a download link for the zip file
                const downloadLink = document.createElement('a');
                downloadLink.href = URL.createObjectURL(content);
                downloadLink.download = 'envmap.zip';
                downloadLink.click();
            });
    });
}

// Add event listeners for drag-and-drop
document.addEventListener('dragover', allowDrop);
document.addEventListener('drop', (e) => {
    const side = e.target.id;
    handleDrop(side, e);
});
