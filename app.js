// app.js
import { db } from './firebase-config.js';
import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// --- UTILIDADES ---
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
if (document.getElementById('view-home')) {
    
    const state = {
        properties: [],
        filter: 'all'
    };

    // Renderizar Tarjeta
    const createCard = (prop, index) => {
        const delay = index * 100; // Efecto cascada
        const badgeClass = prop.type === 'rent' ? 'badge-rent' : 'badge-sale';
        const badgeText = prop.type === 'rent' ? 'Alquiler' : 'Venta';
        const price = prop.period ? `${formatPrice(prop.price)} /${prop.period}` : formatPrice(prop.price);

        return `
            <div class="card" style="animation-delay: ${delay}ms" onclick="app.showDetail('${prop.id}')">
                <div style="overflow: hidden;">
                    <img src="${prop.img}" class="card-img" alt="${prop.title}" loading="lazy">
                    <span class="badge ${badgeClass}" style="position: absolute; top: 15px; left: 15px;">${badgeText}</span>
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

    // Cargar Datos
    const loadProperties = async (filterType = 'all') => {
        const grid = document.getElementById('properties-grid');
        grid.innerHTML = '<div style="text-align:center; grid-column:1/-1; padding:40px;"><i class="fas fa-circle-notch fa-spin fa-2x" style="color:var(--primary)"></i></div>';

        try {
            const q = query(collection(db, "properties"), orderBy("createdAt", "desc"));
            const querySnapshot = await getDocs(q);
            
            let html = '';
            querySnapshot.forEach((doc) => {
                const data = { id: doc.id, ...doc.data() };
                
                // Filtrado simple (Rent vs Sale)
                if (filterType === 'all' || data.type === filterType) {
                    html += createCard(data, html.length); // html.length acts as counter for delay
                }
            });

            grid.innerHTML = html || '<p style="text-align:center; grid-column:1/-1; color:#888;">No hay propiedades disponibles.</p>';
        } catch (error) {
            console.error("Error cargando propiedades:", error);
            grid.innerHTML = '<p style="text-align:center; color:red;">Error al cargar datos.</p>';
        }
    };

    // Inicializar Index
    window.app = {
        init: () => loadProperties('all'),
        filter: (type) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            event.target.classList.add('active');
            loadProperties(type);
        },
        showDetail: (id) => {
            // Aquí podrías abrir un modal o redirigir a details.html
            showToast(`Detalles de ID: ${id} (Funcionalidad pendiente)`, 'success');
        }
    };

    document.addEventListener('DOMContentLoaded', app.init);
}

// --- LÓGICA DE ADMIN ---
if (document.getElementById('admin-panel')) {

    const adminApp = {
        init: async () => {
            adminApp.renderList();
            
            // Listener del formulario
            document.getElementById('property-form').addEventListener('submit', adminApp.addProperty);
        },

        addProperty: async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerText;
            btn.disabled = true;
            btn.innerText = 'Guardando...';

            const formData = {
                title: document.getElementById('title').value,
                price: Number(document.getElementById('price').value),
                period: document.getElementById('period').value,
                type: document.getElementById('type').value,
                category: document.getElementById('category').value,
                location: document.getElementById('location').value,
                beds: Number(document.getElementById('beds').value),
                baths: Number(document.getElementById('baths').value),
                img: document.getElementById('img').value || 'https://picsum.photos/400/300',
                desc: document.getElementById('desc').value,
                createdAt: new Date()
            };

            try {
                await addDoc(collection(db, "properties"), formData);
                showToast('Propiedad agregada exitosamente');
                e.target.reset();
                adminApp.renderList();
            } catch (error) {
                console.error(error);
                showToast('Error al guardar', 'error');
            } finally {
                btn.disabled = false;
                btn.innerText = originalText;
            }
        },

        deleteProperty: async (id) => {
            if(!confirm('¿Seguro que quieres eliminar esta propiedad?')) return;
            
            try {
                await deleteDoc(doc(db, "properties", id));
                showToast('Propiedad eliminada');
                adminApp.renderList();
            } catch (error) {
                showToast('Error al eliminar', 'error');
            }
        },

        renderList: async () => {
            const listContainer = document.getElementById('admin-list');
            listContainer.innerHTML = 'Cargando...';

            const q = query(collection(db, "properties"), orderBy("createdAt", "desc"));
            const snapshot = await getDocs(q);
            
            if (snapshot.empty) {
                listContainer.innerHTML = '<p>No hay propiedades registradas.</p>';
                return;
            }

            let html = '<div class="properties-grid" style="margin-top:20px;">';
            snapshot.forEach(doc => {
                const p = doc.data();
                html += `
                    <div class="card" style="padding:15px; display:flex; flex-direction:column; justify-content:space-between;">
                        <img src="${p.img}" style="height:150px; width:100%; object-fit:cover; border-radius:8px; margin-bottom:10px;">
                        <div>
                            <h4>${p.title}</h4>
                            <small>${formatPrice(p.price)}</small>
                            <div style="margin-top:10px;">
                                <button class="btn btn-danger" style="padding: 5px 10px; font-size:0.8rem;" onclick="adminApp.deleteProperty('${doc.id}')">
                                    <i class="fas fa-trash"></i> Borrar
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
            listContainer.innerHTML = html;
        }
    };

    window.adminApp = adminApp;
    document.addEventListener('DOMContentLoaded', adminApp.init);
}