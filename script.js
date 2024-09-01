window.addEventListener('scroll', function() {
    const sections = document.querySelectorAll('.scene');
    const scrollPosition = window.scrollY;

    sections.forEach((section, index) => {
        const offsetTop = section.offsetTop;
        const offsetBottom = offsetTop + section.offsetHeight;

        if (scrollPosition >= offsetTop && scrollPosition < offsetBottom) {
            section.classList.add('active');
        } else {
            section.classList.remove('active');
        }
    });
});

// Create a scene for 3D visuals
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('scene-2').appendChild(renderer.domElement);

// Create a cube
const geometry = new THREE.BoxGeometry();
const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

camera.position.z = 5;

function animate() {
    requestAnimationFrame(animate);
    cube.rotation.x += 0.01;
    cube.rotation.y += 0.01;
    renderer.render(scene, camera);
}

animate();
