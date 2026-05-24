// app.js
import { db } from './firebase-config.js';
import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// --- UTILIDADES GLOBALES ---

const showToast = (message, type = 'success') => {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = message;
    toast.style.cssText = `
        position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%);
        background: ${type === 'success' ? '#10b981' : '#ef4444'}; color: white;
        padding: 12px 24px; border-radius: 30px; font-weight: 600; z-index: 2000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15); animation: fadeInUp 0.3s forwards;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
};

const formatPrice = (price) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(price);
};


// --- LÓGICA DE INDEX (PÚBLICO) ---
// Detectamos si estamos en index.html buscando el ID 'properties'
if (document.getElementById('properties')) {
    
    const state = {
        properties: [],
        filter: 'all'
    };

    // Función para crear el HTML de una tarjeta
    const createCard = (prop, index) => {
        // Retraso para efecto cascada en animación
        const delay = index * 100; 
        
        const badgeClass = prop.type === 'rent' ? 'badge-rent' : 'badge-sale';
        const badgeText = prop.type === 'rent' ? 'Alquiler' : 'Venta';
        
        // Formato de precio (ej: 150€ / noche o 200.000€)
        const price = prop.period ? `${formatPrice(prop.price)} /${prop.period}` : formatPrice(prop.price);

        return `
            <div class="card" style="animation-delay: ${delay}ms" onclick="app.showDetail('${prop.id}')">
                <div style="overflow: hidden; position: relative;">
                    <img src="${prop.img}" class="card-img" alt="${prop.title}" loading="lazy">
                    <span class="badge ${badgeClass}" style="position: absolute; top: 15px; left: 15px; z-index: 10;">${badgeText}</span>
                </div>
                <div class="card-body">
                    <div class="card-price">${price}</div>
                    <h3 class="card-title">${prop.title}</h3>
                    <div class="card-meta">
                        <span><i class="fas fa-bed"></i> ${prop.beds} Hab.</span>
                        <span><i class="fas fa-bath"></i> ${prop.baths} Baños</span>
                        <span><i class="fas fa-map-marker-alt"></i> ${prop.location}</span>
                    </div>
                </div>
            </div>
        `;
    };

    // Función para cargar propiedades desde Firestore
    const loadProperties = async (filterType = 'all') => {
        const grid = document.getElementById('properties-grid');
        
        // Mostrar spinner de carga
        grid.innerHTML = '<div style="text-align:center; grid-column:1/-1; padding:40px;"><i class="fas fa-circle-notch fa-spin fa-2x" style="color:var(--primary)"></i></div>';

        try {
            // Consulta a Firestore ordenada por fecha de creación
            const q = query(collection(db, "properties"), orderBy("createdAt", "desc"));
            const querySnapshot = await getDocs(q);
            
            let html = '';
            let counter = 0;

            querySnapshot.forEach((doc) => {
                const data = { id: doc.id, ...doc.data() };
                
                // Filtrado: Si es 'all' muestra todo, si no, compara el tipo
                if (filterType === 'all' || data.type === filterType) {
                    html += createCard(data, counter);
                    counter++;
                }
            });

            if (html === '') {
                grid.innerHTML = '<p style="text-align:center; grid-column:1/-1; color:#888;">No se encontraron propiedades con este filtro.</p>';
            } else {
                grid.innerHTML = html;
            }

        } catch (error) {
            console.error("Error cargando propiedades:", error);
            grid.innerHTML = '<p style="text-align:center; color:red;">Error al cargar datos. Revisa la consola.</p>';
            showToast('Error de conexión', 'error');
        }
    };

    // Definición de la app pública (Window object) para que HTML pueda acceder
    window.app = {
        init: () => loadProperties('all'),
        filter: (type) => {
            // Actualizar clases visuales de botones
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            // 'event' es global en el contexto del onclick
            if(event && event.target) event.target.classList.add('active');
            
            loadProperties(type);
        },
        showDetail: (id) => {
            showToast(`Seleccionaste propiedad ID: ${id}`, 'success');
            // Aquí podrías redirigir a una página de detalles: window.location.href = `details.html?id=${id}`;
        }
    };

    // Iniciar al cargar el DOM
    document.addEventListener('DOMContentLoaded', app.init);
}


// --- LÓGICA DE ADMIN ---
// Detectamos si estamos en admin.html
if (document.getElementById('admin-panel')) {

    const adminApp = {
        init: async () => {
            adminApp.renderList();
            
            // Listener del formulario de alta
            const form = document.getElementById('property-form');
            if(form) {
                form.addEventListener('submit', adminApp.addProperty);
            }
        },

        addProperty: async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerText;
            btn.disabled = true;
            btn.innerText = 'Guardando...';

            // Recopilar datos del formulario
            const formData = {
                title: document.getElementById('title').value,
                price: Number(document.getElementById('price').value),
                period: document.getElementById('period').value,
                type: document.getElementById('type').value,
                category: document.getElementById('category').value,
                location: document.getElementById('location').value,
                beds: Number(document.getElementById('beds').value),
                baths: Number(document.getElementById('baths').value),
                img: document.getElementById('img').value || 'https://picsum.photos/seed/new/400/300',
                desc: document.getElementById('desc').value,
                createdAt: new Date() // Guardamos fecha para ordenar
            };

            try {
                await addDoc(collection(db, "properties"), formData);
                showToast('Propiedad agregada exitosamente');
                e.target.reset(); // Limpiar formulario
                adminApp.renderList(); // Refrescar lista
            } catch (error) {
                console.error(error);
                showToast('Error al guardar en BD', 'error');
            } finally {
                btn.disabled = false;
                btn.innerText = originalText;
            }
        },

        deleteProperty: async (id) => {
            if(!confirm('¿Estás seguro de que quieres eliminar esta propiedad? Esta acción no se puede deshacer.')) return;
            
            try {
                await deleteDoc(doc(db, "properties", id));
                showToast('Propiedad eliminada');
                adminApp.renderList();
            } catch (error) {
                console.error(error);
                showToast('Error al eliminar', 'error');
            }
        },

        renderList: async () => {
            const listContainer = document.getElementById('admin-list');
            listContainer.innerHTML = '<div style="text-align:center; padding:20px;"><i class="fas fa-spinner fa-spin"></i> Cargando...</div>';

            try {
                const q = query(collection(db, "properties"), orderBy("createdAt", "desc"));
                const snapshot = await getDocs(q);
                
                if (snapshot.empty) {
                    listContainer.innerHTML = '<p style="text-align:center; color:#888; padding:20px;">No hay propiedades registradas. Usa el formulario de arriba.</p>';
                    return;
                }

                let html = '<div class="properties-grid" style="margin-top:20px;">';
                snapshot.forEach(docSnap => {
                    const p = docSnap.data();
                    html += `
                        <div class="card" style="padding:15px; display:flex; flex-direction:column; justify-content:space-between;">
                            <img src="${p.img}" style="height:150px; width:100%; object-fit:cover; border-radius:8px; margin-bottom:10px;">
                            <div>
                                <h4 style="margin-bottom:5px;">${p.title}</h4>
                                <small style="display:block; margin-bottom:10px; color:var(--primary); font-weight:bold;">${formatPrice(p.price)}</small>
                                <div style="margin-top:10px;">
                                    <button class="btn btn-danger" style="padding: 5px 10px; font-size:0.8rem;" onclick="adminApp.deleteProperty('${docSnap.id}')">
                                        <i class="fas fa-trash"></i> Borrar
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                });
                html += '</div>';
                listContainer.innerHTML = html;
            } catch (error) {
                console.error(error);
                listContainer.innerHTML = '<p style="color:red;">Error al cargar la lista.</p>';
            }
        }
    };

    window.adminApp = adminApp;
    document.addEventListener('DOMContentLoaded', adminApp.init);
}