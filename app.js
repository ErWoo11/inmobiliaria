// app.js
import { db } from './firebase-config.js';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

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

// --- LÓGICA DE INDEX (CLIENTE) ---
if (document.getElementById('properties')) {
    const state = { properties: [], filter: 'all' };

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

    const loadProperties = async (filterType = 'all') => {
        const grid = document.getElementById('properties-grid');
        grid.innerHTML = '<div style="text-align:center; grid-column:1/-1; padding:40px;"><i class="fas fa-circle-notch fa-spin fa-2x" style="color:var(--primary)"></i></div>';

        try {
            const q = query(collection(db, "properties"), orderBy("createdAt", "desc"));
            const querySnapshot = await getDocs(q);
            
            state.properties = []; 
            let html = '';
            let counter = 0;

            querySnapshot.forEach((doc) => {
                const data = { id: doc.id, ...doc.data() };
                state.properties.push(data);
                if (filterType === 'all' || data.type === filterType) {
                    html += createCard(data, counter);
                    counter++;
                }
            });

            grid.innerHTML = html || '<p style="text-align:center; grid-column:1/-1; color:#888;">No se encontraron propiedades.</p>';

        } catch (error) {
            console.error(error);
            grid.innerHTML = '<p style="text-align:center; color:red;">Error de conexión.</p>';
            showToast('Error de conexión', 'error');
        }
    };

    window.app = {
        init: () => loadProperties('all'),
        filter: (type) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            if(event && event.target) event.target.classList.add('active');
            loadProperties(type);
        },
        
        showDetail: (id) => {
            const property = state.properties.find(p => p.id === id);
            if (!property) return;
            const priceText = property.period ? `${formatPrice(property.price)} /${property.period}` : formatPrice(property.price);
            
            document.getElementById('modal-img').src = property.img;
            document.getElementById('modal-title').innerText = property.title;
            document.getElementById('modal-price').innerText = priceText;
            document.getElementById('modal-location').querySelector('span').innerText = property.location;
            document.getElementById('modal-beds').innerText = property.beds;
            document.getElementById('modal-baths').innerText = property.baths;
            document.getElementById('modal-desc').innerText = property.desc || "Sin descripción.";
            
            const badgeEl = document.getElementById('modal-badge');
            badgeEl.className = property.type === 'rent' ? 'badge badge-rent' : 'badge badge-sale';
            badgeEl.innerText = property.type === 'rent' ? 'Alquiler Vacacional' : 'En Venta';

            document.getElementById('property-modal').classList.add('open');
            document.body.style.overflow = 'hidden';
        },

        closeModal: () => {
            document.getElementById('property-modal').classList.remove('open');
            document.body.style.overflow = '';
        },

        // NUEVA LÓGICA DE CONTACTO
        contactAgent: () => {
            const title = document.getElementById('modal-title').innerText;
            document.getElementById('contact-prop-title').innerText = title;
            document.getElementById('contact-modal').classList.add('open');
        },

        closeContactModal: () => {
            document.getElementById('contact-modal').classList.remove('open');
        },

        sendContact: async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            const originalText = btn.innerText;
            btn.innerText = 'Enviando...';
            btn.disabled = true;

            const msgData = {
                propName: document.getElementById('contact-prop-title').innerText,
                clientName: document.getElementById('contact-name').value,
                clientEmail: document.getElementById('contact-email').value,
                clientPhone: document.getElementById('contact-phone').value,
                message: document.getElementById('contact-message').value,
                date: new Date()
            };

            try {
                await addDoc(collection(db, "messages"), msgData);
                showToast('¡Mensaje enviado al agente!', 'success');
                app.closeContactModal();
                e.target.reset();
            } catch (err) {
                showToast('Error al enviar', 'error');
            } finally {
                btn.innerText = originalText;
                btn.disabled = false;
            }
        }
    };

    document.getElementById('property-modal').addEventListener('click', (e) => { if (e.target.id === 'property-modal') app.closeModal(); });
    document.getElementById('contact-modal').addEventListener('click', (e) => { if (e.target.id === 'contact-modal') app.closeContactModal(); });

    document.addEventListener('DOMContentLoaded', app.init);
}


// --- LÓGICA DE ADMIN ---
if (document.getElementById('admin-panel')) {

    const adminApp = {
        data: { properties: [], messages: [] },

        init: async () => {
            adminApp.loadDashboard(); // Carga stats y datos iniciales
            
            // Listener Formulario (Crear/Editar)
            document.getElementById('property-form').addEventListener('submit', adminApp.saveProperty);
        },

        // --- NAVEGACIÓN ENTRE VISTAS ---
        switchView: (viewName, btnElement) => {
            // Ocultar todas
            document.querySelectorAll('.admin-view').forEach(el => el.style.display = 'none');
            // Mostrar seleccionada
            document.getElementById(`view-${viewName}`).style.display = 'block';
            
            // Actualizar Sidebar
            if(btnElement) {
                document.querySelectorAll('.admin-sidebar .nav-link').forEach(l => l.classList.remove('active'));
                btnElement.classList.add('active');
            }

            if (viewName === 'dashboard') adminApp.loadDashboard();
            if (viewName === 'properties') adminApp.renderProperties();
            if (viewName === 'messages') adminApp.renderMessages();
        },

        // --- DASHBOARD ---
        loadDashboard: async () => {
            try {
                // Cargar propiedades
                const pSnap = await getDocs(query(collection(db, "properties")));
                const properties = pSnap.docs.map(d => ({id: d.id, ...d.data()}));
                
                // Cargar mensajes
                const mSnap = await getDocs(query(collection(db, "messages"), orderBy("date", "desc")));
                const messages = mSnap.docs.map(d => d.data());

                // Calcular Stats
                const totalProps = properties.length;
                const totalMsgs = messages.length;
                const rentals = properties.filter(p => p.type === 'rent').length;
                const sales = properties.filter(p => p.type === 'sale').length;

                // Animar números
                document.getElementById('stat-props').innerText = totalProps;
                document.getElementById('stat-msgs').innerText = totalMsgs;
                document.getElementById('stat-rentals').innerText = rentals;
                document.getElementById('stat-sales').innerText = sales;

                // Badge en sidebar
                const badge = document.getElementById('msg-badge');
                if (totalMsgs > 0) {
                    badge.style.display = 'inline-block';
                    badge.innerText = totalMsgs;
                } else {
                    badge.style.display = 'none';
                }

            } catch (error) { console.error("Dashboard error:", error); }
        },

        // --- PROPIEDADES (CRUD) ---
        renderProperties: async () => {
            const listContainer = document.getElementById('admin-list');
            listContainer.innerHTML = '<div style="text-align:center; grid-column:1/-1;"><i class="fas fa-spinner fa-spin"></i></div>';
            
            try {
                const q = query(collection(db, "properties"), orderBy("createdAt", "desc"));
                const snapshot = await getDocs(q);
                
                let html = '';
                snapshot.forEach(docSnap => {
                    const p = docSnap.data();
                    html += `
                        <div class="card" style="padding:15px; display:flex; flex-direction:column; justify-content:space-between;">
                            <img src="${p.img}" style="height:150px; width:100%; object-fit:cover; border-radius:8px; margin-bottom:10px;">
                            <div>
                                <h4 style="margin-bottom:5px;">${p.title}</h4>
                                <small style="color:var(--primary); font-weight:bold;">${formatPrice(p.price)}</small>
                                <div style="margin-top:10px; display:flex; gap:10px;">
                                    <button class="btn btn-primary" style="flex:1; padding:5px; font-size:0.8rem;" onclick="adminApp.editProperty('${docSnap.id}')">
                                        <i class="fas fa-edit"></i> Editar
                                    </button>
                                    <button class="btn btn-danger" style="padding: 5px 10px; font-size:0.8rem;" onclick="adminApp.deleteProperty('${docSnap.id}')">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                });
                listContainer.innerHTML = html;
            } catch (error) { console.error(error); }
        },

        saveProperty: async (e) => {
            e.preventDefault();
            const editId = document.getElementById('edit-id').value;
            const btn = document.getElementById('btn-save');
            
            btn.disabled = true;
            btn.innerText = editId ? 'Actualizando...' : 'Guardando...';

            const formData = {
                title: document.getElementById('title').value,
                price: Number(document.getElementById('price').value),
                period: document.getElementById('period').value,
                type: document.getElementById('type').value,
                category: document.getElementById('category').value,
                location: document.getElementById('location').value,
                beds: Number(document.getElementById('beds').value),
                baths: Number(document.getElementById('baths').value),
                img: document.getElementById('img').value,
                desc: document.getElementById('desc').value,
            };

            try {
                if (editId) {
                    // ACTUALIZAR
                    await updateDoc(doc(db, "properties", editId), formData);
                    showToast('Propiedad actualizada');
                } else {
                    // CREAR
                    await addDoc(collection(db, "properties"), { ...formData, createdAt: new Date() });
                    showToast('Propiedad creada');
                }
                adminApp.resetForm();
                adminApp.renderProperties();
            } catch (error) {
                console.error(error);
                showToast('Error al guardar', 'error');
            } finally {
                btn.disabled = false;
                btn.innerText = editId ? 'Actualizar' : 'Publicar';
            }
        },

        editProperty: async (id) => {
            // Buscar en DOM (rápido) o BD (seguro). Haremos query rápida.
            try {
                const docSnap = await getDocs(query(collection(db, "properties")));
                let prop = null;
                docSnap.forEach(d => { if(d.id === id) prop = {id: d.id, ...d.data()}; });

                if(prop) {
                    // Rellenar formulario
                    document.getElementById('edit-id').value = prop.id;
                    document.getElementById('title').value = prop.title;
                    document.getElementById('price').value = prop.price;
                    document.getElementById('period').value = prop.period || "";
                    document.getElementById('type').value = prop.type;
                    document.getElementById('category').value = prop.category;
                    document.getElementById('location').value = prop.location;
                    document.getElementById('beds').value = prop.beds;
                    document.getElementById('baths').value = prop.baths;
                    document.getElementById('img').value = prop.img;
                    document.getElementById('desc').value = prop.desc || "";

                    // Cambiar estado visual del formulario
                    document.getElementById('form-title').innerHTML = '<i class="fas fa-edit"></i> Editar Propiedad';
                    document.getElementById('btn-save').innerText = 'Actualizar Propiedad';
                    document.getElementById('btn-cancel').style.display = 'inline-block';

                    // Scroll arriba al formulario
                    document.querySelector('.admin-main').scrollTo({ top: 0, behavior: 'smooth' });
                }
            } catch(e) { console.error(e); }
        },

        deleteProperty: async (id) => {
            if(!confirm('¿Eliminar esta propiedad?')) return;
            try {
                await deleteDoc(doc(db, "properties", id));
                showToast('Eliminado');
                adminApp.renderProperties();
            } catch(e) { showToast('Error al eliminar', 'error'); }
        },

        resetForm: () => {
            document.getElementById('property-form').reset();
            document.getElementById('edit-id').value = "";
            document.getElementById('form-title').innerHTML = '<i class="fas fa-plus-circle"></i> Nueva Propiedad';
            document.getElementById('btn-save').innerText = 'Publicar';
            document.getElementById('btn-cancel').style.display = 'none';
        },

        // --- MENSAJES ---
        renderMessages: async () => {
            const container = document.getElementById('messages-container');
            container.innerHTML = '<p>Cargando...</p>';
            
            try {
                const q = query(collection(db, "messages"), orderBy("date", "desc"));
                const snap = await getDocs(q);
                
                if(snap.empty) {
                    container.innerHTML = '<p>No hay mensajes nuevos.</p>';
                    return;
                }

                let html = '';
                snap.forEach(doc => {
                    const m = doc.data();
                    const date = m.date ? new Date(m.date).toLocaleDateString() : 'Fecha desconocida';
                    html += `
                        <div class="message-item">
                            <div class="msg-info">
                                <h4>${m.clientName} <small>(${m.clientEmail})</small></h4>
                                <p style="margin:5px 0; color:#444;">${m.message}</p>
                                <small><i class="fas fa-phone"></i> ${m.clientPhone} • ${date}</small>
                            </div>
                            <div style="text-align:right;">
                                <div class="msg-prop">Interesado en: ${m.propName}</div>
                            </div>
                        </div>
                    `;
                });
                container.innerHTML = html;
            } catch(e) { console.error(e); }
        }
    };

    window.adminApp = adminApp;
    document.addEventListener('DOMContentLoaded', adminApp.init);
}