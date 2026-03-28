import tailwindScrollbar from 'tailwind-scrollbar';

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                novo: {
                    primary: '#713AEC',  // Violeta primario
                    dark: '#10082B',     // Azul oscuro
                    secondary: '#2E1F56',// Violeta medio
                    light: '#FAF9FB',    // Gris claro
                    accent: '#6E36E7',   // Violeta acento
                }
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            }
        },
    },
    plugins: [
        tailwindScrollbar({ nocompatible: true }),
    ],
}
