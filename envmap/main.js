// main.js

let images = {};

function uploadImage(side) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = document.getElementById(side);
                img.style.backgroundImage = `url(${event.target.result})`;
                images[side] = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    };

    input.click();
}

function generateCubemap() {
    if (Object.keys(images).length !== 6) {
        alert('Please upload images for all sides.');
        return;
    }

    const downloadLink = document.createElement('a');

    Object.keys(images).forEach((side, index) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

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

            downloadLink.href = canvas.toDataURL('image/png');
            downloadLink.download = `cubemap_${image_index}.png`;
            downloadLink.click();
        };

        img.src = images[side];
    });
}
