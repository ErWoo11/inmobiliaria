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
if (document.getElementById('properties')) {
    
    const state = {
        properties: [], // Aquí guardaremos TODOS los datos
        filter: 'all'
    };

    // Función para crear el HTML de una tarjeta
    const createCard = (prop, index) => {
        const delay = index * 100; 
        const badgeClass = prop.type === 'rent' ? 'badge-rent' : 'badge-sale';
        const badgeText = prop.type === 'rent' ? 'Alquiler' : 'Venta';
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
        grid.innerHTML = '<div style="text-align:center; grid-column:1/-1; padding:40px;"><i class="fas fa-circle-notch fa-spin fa-2x" style="color:var(--primary)"></i></div>';

        try {
            const q = query(collection(db, "properties"), orderBy("createdAt", "desc"));
            const querySnapshot = await getDocs(q);
            
            // IMPORTANTE: Limpiamos y volvemos a llenar state.properties
            state.properties = []; 
            let html = '';
            let counter = 0;

            querySnapshot.forEach((doc) => {
                const data = { id: doc.id, ...doc.data() };
                
                // Guardamos en memoria para usar en el modal
                state.properties.push(data);

                if (filterType === 'all' || data.type === filterType) {
                    html += createCard(data, counter);
                    counter++;
                }
            });

            if (html === '') {
                grid.innerHTML = '<p style="text-align:center; grid-column:1/-1; color:#888;">No se encontraron propiedades.</p>';
            } else {
                grid.innerHTML = html;
            }

        } catch (error) {
            console.error("Error cargando propiedades:", error);
            grid.innerHTML = '<p style="text-align:center; color:red;">Error al cargar datos.</p>';
            showToast('Error de conexión', 'error');
        }
    };

    // Definición de la app pública
    window.app = {
        init: () => loadProperties('all'),
        
        filter: (type) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            if(event && event.target) event.target.classList.add('active');
            loadProperties(type);
        },
        
        // NUEVA FUNCIÓN: Abrir Modal
        showDetail: (id) => {
            // Buscar la propiedad en nuestro estado local
            const property = state.properties.find(p => p.id === id);
            
            if (!property) {
                showToast('Propiedad no encontrada', 'error');
                return;
            }

            // Rellenar datos en el HTML del Modal
            const priceText = property.period ? `${formatPrice(property.price)} /${property.period}` : formatPrice(property.price);
            
            document.getElementById('modal-img').src = property.img;
            document.getElementById('modal-title').innerText = property.title;
            document.getElementById('modal-price').innerText = priceText;
            document.getElementById('modal-location').querySelector('span').innerText = property.location;
            document.getElementById('modal-beds').innerText = property.beds;
            document.getElementById('modal-baths').innerText = property.baths;
            document.getElementById('modal-desc').innerText = property.desc || "Sin descripción detallada disponible.";
            
            // Configurar Badge
            const badgeEl = document.getElementById('modal-badge');
            if (property.type === 'rent') {
                badgeEl.className = 'badge badge-rent';
                badgeEl.innerText = 'Alquiler Vacacional';
            } else {
                badgeEl.className = 'badge badge-sale';
                badgeEl.innerText = 'En Venta';
            }

            // Mostrar Modal
            document.getElementById('property-modal').classList.add('open');
            document.body.style.overflow = 'hidden'; // Evitar scroll de fondo
        },

        // Cerrar Modal
        closeModal: () => {
            document.getElementById('property-modal').classList.remove('open');
            document.body.style.overflow = ''; // Restaurar scroll
        },

        contactAgent: () => {
            showToast('Solicitud de contacto enviada al agente.', 'success');
            setTimeout(() => app.closeModal(), 1500);
        }
    };

    // Cerrar modal si clic fuera del contenido
    document.getElementById('property-modal').addEventListener('click', (e) => {
        if (e.target.id === 'property-modal') app.closeModal();
    });

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