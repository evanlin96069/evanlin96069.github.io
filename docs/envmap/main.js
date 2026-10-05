const sides = ['right', 'left', 'back', 'front', 'up', 'down'];
const images = {};
sides.forEach(side => {
    images[side] = null;
});

function uploadImage(side) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;

    input.onchange = handleFileUpload(side);

    input.click();
}

function handleFileUpload(side) {
    return (e) => {
        const files = e.target.files;
        handleFiles(side, files);
    };
}

function handleDrop(side, event) {
    event.preventDefault();
    const files = event.dataTransfer.files;

    if (files.length > 0) {
        handleFiles(side, files);
    } else {
        // If no files, consider it as a drag to swap
        handleSwap(side, event);
    }
}

function handleFiles(side, files) {
    if (files.length === 0) {
        alert('Please drop an image file.');
        return;
    }

    if (files.length === 1) {
        const file = files[0];
        if (!file.type.startsWith('image/')) {
            alert('Please drop a valid image file.');
            return;
        }
        handleImage(side, file);
    } else if (files.length === 6) {
        // If the user drops six files, apply them to all squares
        const validFiles = Array.from(files).every(file => file.type.startsWith('image/'));
        if (!validFiles) {
            alert('Please drop valid image files.');
            return;
        }

        for (let i = 0; i < 6; i++) {
            const file = files[i];
            const currentSide = sides[i];

            handleImage(currentSide, file);
        }
    } else {
        alert("Please drop either one or six image files.")
    }
}

function handleImage(side, file) {
    if (!sides.includes(side)) {
        return;
    }

    const img = document.getElementById(side);
    img.style.backgroundImage = `url(${URL.createObjectURL(file)})`;
    images[side] = URL.createObjectURL(file);
}

function handleSwap(targetSide, event) {
    const sourceSide = event.dataTransfer.getData('text/plain');

    if (!sides.includes(sourceSide) || !sides.includes(targetSide)) {
        return;
    }

    // Swap the images between source and target sides
    const tempImage = images[targetSide];
    images[targetSide] = images[sourceSide];
    images[sourceSide] = tempImage;

    const sourceElement = document.getElementById(sourceSide);
    const targetElement = document.getElementById(targetSide);

    sourceElement.style.backgroundImage = images[sourceSide] ? `url(${images[sourceSide]})` : 'none';
    targetElement.style.backgroundImage = images[targetSide] ? `url(${images[targetSide]})` : 'none';

}

function allowDrop(event) {
    event.preventDefault();
}


function generateEnvmap() {
    if (!Object.values(images).every(value => value !== null)) {
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

for (const side of sides) {
    const element = document.getElementById(side);

    element.draggable = true;
    element.ondrop = (e) => handleDrop(side, e);
    element.ondragstart = (e) => e.dataTransfer.setData('text/plain', e.target.id);
    element.ondragover = allowDrop;
}
