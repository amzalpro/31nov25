import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Loader2 } from 'lucide-react';

interface STLViewerProps {
  stlContent: string;
  backgroundColor?: string;
}

export const STLViewer: React.FC<STLViewerProps> = ({ stlContent, backgroundColor = '#f8fafc' }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mountRef.current || !stlContent) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(backgroundColor);

    // Camera setup
    const camera = new THREE.PerspectiveCamera(45, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 10);

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.innerHTML = ''; // Clear previous
    mountRef.current.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 2); // Soft white light
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);
    
    const backLight = new THREE.DirectionalLight(0xffffff, 1);
    backLight.position.set(-1, -1, -1);
    scene.add(backLight);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.enableZoom = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 2.0;

    // Load STL
    try {
      const loader = new STLLoader();
      const geometry = loader.parse(stlContent);
      
      // Center geometry
      geometry.computeBoundingBox();
      geometry.center();

      // Create material
      const material = new THREE.MeshPhongMaterial({ 
        color: 0x4f46e5, 
        specular: 0x111111, 
        shininess: 200 
      });
      
      const mesh = new THREE.Mesh(geometry, material);
      
      // Adjust camera based on bounding box
      const box = geometry.boundingBox;
      if (box) {
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 * Math.tan(fov * 2));
        cameraZ *= 2.5; // Zoom out a bit
        camera.position.z = cameraZ;
        
        const minZ = box.min.z;
        const cameraToFarEdge = ( minZ < 0 ) ? -minZ + cameraZ : cameraZ - minZ;
        camera.far = cameraToFarEdge * 3;
        camera.updateProjectionMatrix();
      }

      scene.add(mesh);

      // Animation Loop
      let animationId: number;
      const animate = () => {
        animationId = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      // Cleanup
      return () => {
        cancelAnimationFrame(animationId);
        if (mountRef.current && renderer.domElement) {
            // check if mountRef.current still contains the child before removing
            if (mountRef.current.contains(renderer.domElement)) {
               mountRef.current.removeChild(renderer.domElement);
            }
        }
        geometry.dispose();
        material.dispose();
        renderer.dispose();
      };

    } catch (err) {
      console.error("Error parsing STL:", err);
      setError("Impossible de charger le modèle 3D.");
    }
  }, [stlContent, backgroundColor]);

  if (error) {
      return <div className="w-full h-full flex items-center justify-center bg-slate-100 text-red-500 text-xs">{error}</div>;
  }

  return <div ref={mountRef} className="w-full h-full" />;
};