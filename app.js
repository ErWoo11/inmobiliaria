// app.js
import { db } from './firebase-config.js';
import { collection, getDocs, getDoc, addDoc, deleteDoc, doc, updateDoc, query, orderBy, where } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

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

// ==========================================
// LÓGICA INDEX (CLIENTE)
// ==========================================
if (document.getElementById('properties')) {
    const state = { 
        properties: [], 
        filter: 'all', 
        currentImages: [], 
        currentSlide: 0,
        currentContactRef: null // Para guardar la ref al contactar
    };

    const createCard = (prop, index) => {
        const delay = index * 100; 
        const badgeClass = prop.type === 'rent' ? 'badge-rent' : 'badge-sale';
        const badgeText = prop.type === 'rent' ? 'Alquiler' : 'Venta';
        const mainImg = Array.isArray(prop.img) && prop.img.length > 0 ? prop.img[0] : (prop.img || 'https://picsum.photos/400/300');
        const price = prop.period ? `${formatPrice(prop.price)} /${prop.period}` : formatPrice(prop.price);
        
        // Badge de Referencia
        const refDisplay = prop.ref ? `<span class="ref-badge">${prop.ref}</span>` : '';

        // --- LÓGICA DE ESTADO (RESERVADO/VENDIDO) ---
        let statusOverlay = '';
        let imgClass = 'card-img';
        
        if (prop.status === 'reserved' || prop.status === 'sold') {
            imgClass += ' img-grayscale'; // Efecto blanco y negro
            const statusText = prop.status === 'reserved' ? 'RESERVADO' : 'VENDIDO';
            const colorClass = prop.status === 'reserved' ? 'bg-reserved' : 'bg-sold';
            statusOverlay = `<div class="status-overlay ${colorClass}">${statusText}</div>`;
        }

        return `
            <div class="card" style="animation-delay: ${delay}ms" onclick="app.showDetail('${prop.id}')">
                <div style="overflow: hidden; position: relative;">
                    <img src="${mainImg}" class="${imgClass}" alt="${prop.title}" loading="lazy">
                    ${statusOverlay}
                    ${Array.isArray(prop.img) && prop.img.length > 1 ? `<span style="position:absolute; bottom:10px; right:10px; background:rgba(0,0,0,0.6); color:white; padding:2px 6px; border-radius:10px; font-size:0.7rem;"><i class="fas fa-images"></i> +${prop.img.length-1}</span>` : ''}
                    <span class="badge ${badgeClass}" style="position: absolute; top: 15px; left: 15px; z-index: 10;">${badgeText}</span>
                </div>
                <div class="card-body">
                    ${refDisplay}
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
            grid.innerHTML = html || '<p style="text-align:center; grid-column:1/-1; color:#888;">No hay propiedades.</p>';
        } catch (error) { console.error(error); grid.innerHTML = '<p style="text-align:center; color:red;">Error de conexión.</p>'; }
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

            // Preparar imágenes (Array)
            state.currentImages = Array.isArray(property.img) ? property.img : [property.img || 'https://picsum.photos/400/300'];
            state.currentSlide = 0;

            // Renderizar Slider
            app.renderSlider();

            // Datos Texto
            const priceText = property.period ? `${formatPrice(property.price)} /${property.period}` : formatPrice(property.price);
            document.getElementById('modal-title').innerText = property.title;
            document.getElementById('modal-price').innerText = priceText;
            document.getElementById('modal-location').querySelector('span').innerText = property.location;
            document.getElementById('modal-beds').innerText = property.beds;
            document.getElementById('modal-baths').innerText = property.baths;
            document.getElementById('modal-desc').innerText = property.desc || "Sin descripción.";
            
            // Badge Tipo
            const badgeEl = document.getElementById('modal-badge');
            badgeEl.className = property.type === 'rent' ? 'badge badge-rent' : 'badge badge-sale';
            badgeEl.innerText = property.type === 'rent' ? 'Alquiler Vacacional' : 'En Venta';

            document.getElementById('property-modal').classList.add('open');
            document.body.style.overflow = 'hidden';
        },

        renderSlider: () => {
            const slider = document.getElementById('modal-slider');
            const dots = document.getElementById('slider-dots');
            slider.innerHTML = '';
            dots.innerHTML = '';

            state.currentImages.forEach((imgUrl, index) => {
                const div = document.createElement('div');
                div.className = `modal-slide ${index === 0 ? 'active' : ''}`;
                div.innerHTML = `<img src="${imgUrl}" style="width:100%; height:100%; object-fit:contain;">`;
                slider.appendChild(div);

                const dot = document.createElement('div');
                dot.className = `dot ${index === 0 ? 'active' : ''}`;
                dot.onclick = () => app.goToSlide(index);
                dots.appendChild(dot);
            });
        },

        changeSlide: (dir) => {
            const slides = document.querySelectorAll('.modal-slide');
            const dots = document.querySelectorAll('.dot');
            if(slides.length === 0) return;
            slides[state.currentSlide].classList.remove('active');
            dots[state.currentSlide].classList.remove('active');

            state.currentSlide += dir;
            if (state.currentSlide >= slides.length) state.currentSlide = 0;
            if (state.currentSlide < 0) state.currentSlide = slides.length - 1;

            slides[state.currentSlide].classList.add('active');
            dots[state.currentSlide].classList.add('active');
        },

        goToSlide: (index) => {
            const slides = document.querySelectorAll('.modal-slide');
            const dots = document.querySelectorAll('.dot');
            if(slides.length === 0) return;
            slides[state.currentSlide].classList.remove('active');
            dots[state.currentSlide].classList.remove('active');
            state.currentSlide = index;
            slides[state.currentSlide].classList.add('active');
            dots[state.currentSlide].classList.add('active');
        },

        closeModal: () => {
            document.getElementById('property-modal').classList.remove('open');
            document.body.style.overflow = '';
        },

        contactAgent: () => {
            const title = document.getElementById('modal-title').innerText;
            // Buscar la propiedad actual para obtener la referencia
            const prop = state.properties.find(p => p.title === title);
            const ref = prop ? (prop.ref || '') : '';
            
            // Guardar ref temporalmente
            app.currentContactRef = ref;

            document.getElementById('contact-prop-title').innerText = `${title} ${ref ? `(${ref})` : ''}`;
            document.getElementById('contact-modal').classList.add('open');
        },

        closeContactModal: () => document.getElementById('contact-modal').classList.remove('open'),

        sendContact: async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            btn.disabled = true; btn.innerText = 'Enviando...';
            
            const msgData = {
                propName: document.getElementById('contact-prop-title').innerText,
                clientName: document.getElementById('contact-name').value,
                clientEmail: document.getElementById('contact-email').value,
                clientPhone: document.getElementById('contact-phone').value,
                message: document.getElementById('contact-message').value,
                read: false,
                date: new Date()
            };
            try {
                await addDoc(collection(db, "messages"), msgData);
                showToast('¡Mensaje enviado!', 'success');
                app.closeContactModal();
                e.target.reset();
            } catch (err) { showToast('Error', 'error'); }
            finally { btn.disabled = false; btn.innerText = 'Enviar Solicitud'; }
        }
    };
    document.getElementById('property-modal').addEventListener('click', (e) => { if (e.target.id === 'property-modal') app.closeModal(); });
    document.getElementById('contact-modal').addEventListener('click', (e) => { if (e.target.id === 'contact-modal') app.closeContactModal(); });
    document.addEventListener('DOMContentLoaded', app.init);
}

// ==========================================
// LÓGICA ADMIN
// ==========================================
if (document.getElementById('admin-panel')) {
    const adminApp = {
        data: { properties: [], messages: [], clients: [] },

        init: async () => {
            adminApp.loadDashboard();
            // Listener para el formulario dentro del MODAL
            document.getElementById('property-form-modal').addEventListener('submit', adminApp.saveProperty);
            
            window.addEventListener('resize', () => {
                if(window.innerWidth > 992) {
                    const sidebar = document.querySelector('.admin-sidebar');
                    const overlay = document.querySelector('.sidebar-overlay');
                    if(sidebar) sidebar.classList.remove('open');
                    if(overlay) overlay.classList.remove('active');
                }
            });
        },

        // --- NAVEGACIÓN Y UI ---
        switchView: (viewName, btnElement) => {
            document.querySelectorAll('.admin-view').forEach(el => el.style.display = 'none');
            document.getElementById(`view-${viewName}`).style.display = 'block';
            
            if(btnElement) {
                document.querySelectorAll('.admin-sidebar .nav-link').forEach(l => l.classList.remove('active'));
                btnElement.classList.add('active');
            }

            if(window.innerWidth <= 992) adminApp.toggleMenu();

            if (viewName === 'dashboard') adminApp.loadDashboard();
            if (viewName === 'inmuebles') adminApp.renderInmuebles();
            if (viewName === 'messages') adminApp.renderMessages();
            if (viewName === 'clients') adminApp.renderClients();
        },

        toggleMenu: () => {
            const sidebar = document.querySelector('.admin-sidebar');
            const overlay = document.querySelector('.sidebar-overlay');
            if (sidebar && overlay) {
                sidebar.classList.toggle('open');
                overlay.classList.toggle('active');
            }
        },

        // --- DASHBOARD ---
        loadDashboard: async () => {
            try {
                const [pSnap, mSnap, cSnap] = await Promise.all([
                    getDocs(query(collection(db, "properties"))),
                    getDocs(query(collection(db, "messages"))),
                    getDocs(query(collection(db, "clients")))
                ]);
                
                const messages = mSnap.docs.map(d => d.data());
                const unreadCount = messages.filter(m => m.read === false).length;

                document.getElementById('stat-props').innerText = pSnap.size;
                document.getElementById('stat-msgs').innerText = unreadCount; 
                document.getElementById('stat-clients').innerText = cSnap.size;
                
                const badge = document.getElementById('msg-badge');
                if (unreadCount > 0) {
                    badge.style.display = 'inline-block';
                    badge.innerText = unreadCount;
                } else {
                    badge.style.display = 'none';
                }
            } catch (e) { console.error(e); }
        },

        // --- INMUEBLES (MODAL + FILTROS + REF) ---
        generateRef: async () => {
            const year = new Date().getFullYear();
            const random = Math.floor(1000 + Math.random() * 9000);
            return `REF-${year}-${random}`;
        },

        openPropertyModal: async (id = null) => {
            const modal = document.getElementById('property-admin-modal');
            const form = document.getElementById('property-form-modal');
            
            form.reset();
            document.getElementById('edit-id').value = "";
            document.getElementById('form-title-modal').innerText = "Nuevo Inmueble";
            document.getElementById('btn-save-modal').innerText = "Guardar Inmueble";

            if (id) {
                // MODO EDICIÓN
                try {
                    const docSnap = await getDocs(query(collection(db, "properties")));
                    let prop = null;
                    docSnap.forEach(d => { if(d.id === id) prop = {id: d.id, ...d.data()}; });
                    
                    if(prop) {
                        document.getElementById('edit-id').value = prop.id;
                        document.getElementById('ref-number').value = prop.ref || "N/A";
                        document.getElementById('title').value = prop.title;
                        document.getElementById('price').value = prop.price;
                        document.getElementById('period').value = prop.period || "";
                        document.getElementById('type').value = prop.type;
                        document.getElementById('status').value = prop.status || 'available';
                        document.getElementById('category').value = prop.category;
                        document.getElementById('location').value = prop.location;
                        document.getElementById('beds').value = prop.beds;
                        document.getElementById('baths').value = prop.baths;
                        
                        const imgText = Array.isArray(prop.img) ? prop.img.join('\n') : prop.img;
                        document.getElementById('img').value = imgText;
                        document.getElementById('desc').value = prop.desc || "";

                        document.getElementById('form-title-modal').innerText = "Editar Inmueble";
                        document.getElementById('btn-save-modal').innerText = "Actualizar Inmueble";
                    }
                } catch(e) { console.error(e); }
            } else {
                // MODO CREACIÓN
                const newRef = await adminApp.generateRef();
                document.getElementById('ref-number').value = newRef;
                document.getElementById('status').value = 'available';
            }

            modal.classList.add('open');
            document.body.style.overflow = 'hidden';
        },

        closePropertyModal: () => {
            document.getElementById('property-admin-modal').classList.remove('open');
            document.body.style.overflow = '';
        },

        applyFilters: () => {
            adminApp.renderInmuebles();
        },

        clearFilters: () => {
            document.getElementById('filter-ref').value = "";
            document.getElementById('filter-status').value = "";
            document.getElementById('filter-type').value = "";
            document.getElementById('filter-category').value = "";
            document.getElementById('filter-date').value = "";
            adminApp.renderInmuebles();
        },

        renderInmuebles: async () => {
            const listContainer = document.getElementById('admin-list');
            listContainer.innerHTML = '<div style="text-align:center; grid-column:1/-1;"><i class="fas fa-spinner fa-spin"></i></div>';
            
            try {
                const fRef = document.getElementById('filter-ref').value.toLowerCase();
                const fStatus = document.getElementById('filter-status').value;
                const fType = document.getElementById('filter-type').value;
                const fCategory = document.getElementById('filter-category').value;
                const fDate = document.getElementById('filter-date').value;

                const q = query(collection(db, "properties"), orderBy("createdAt", "desc"));
                const snapshot = await getDocs(q);
                
                let html = '';
                let count = 0;

                snapshot.forEach(docSnap => {
                    const p = docSnap.data();
                    let match = true;
                    
                    if (fRef && (!p.ref || !p.ref.toLowerCase().includes(fRef))) match = false;
                    if (fStatus && p.status !== fStatus) match = false;
                    if (fType && p.type !== fType) match = false;
                    if (fCategory && p.category !== fCategory) match = false;
                    
                    if (fDate && p.createdAt) {
                        const propDate = new Date(p.createdAt.seconds * 1000);
                        const propYearMonth = propDate.toISOString().slice(0, 7);
                        if (propYearMonth !== fDate) match = false;
                    }

                    if (match) {
                        count++;
                        const imgDisplay = Array.isArray(p.img) ? p.img[0] : p.img;
                        const status = p.status || 'available';
                        let statusLabel = 'Disponible';
                        let statusClass = 'available';
                        if (status === 'reserved') { statusLabel = 'Reservado'; statusClass = 'reserved'; }
                        else if (status === 'sold') { statusLabel = 'Vendido'; statusClass = 'sold'; }

                        html += `
                            <div class="card" style="padding:15px; display:flex; flex-direction:column; justify-content:space-between;">
                                <div style="position:relative;">
                                    <img src="${imgDisplay}" style="height:150px; width:100%; object-fit:cover; border-radius:8px; margin-bottom:10px;">
                                    <span style="position:absolute; top:5px; left:5px; background:rgba(0,0,0,0.7); color:white; padding:2px 6px; font-size:0.7rem; border-radius:4px;">${p.ref || 'Sin Ref'}</span>
                                </div>
                                <div>
                                    <h4 style="margin-bottom:5px;">${p.title}</h4>
                                    <div style="margin-bottom:8px;"><span class="status-badge ${statusClass}">${statusLabel}</span></div>
                                    <small style="color:var(--primary); font-weight:bold;">${formatPrice(p.price)}</small>
                                    <div style="margin-top:10px; display:flex; gap:10px;">
                                        <button class="btn btn-primary" style="flex:1; padding:5px; font-size:0.8rem;" onclick="adminApp.openPropertyModal('${docSnap.id}')"><i class="fas fa-edit"></i> Editar</button>
                                        <button class="btn btn-danger" style="padding: 5px 10px; font-size:0.8rem;" onclick="adminApp.deleteProperty('${docSnap.id}')"><i class="fas fa-trash"></i></button>
                                    </div>
                                </div>
                            </div>
                        `;
                    }
                });

                if (count === 0) listContainer.innerHTML = '<p style="text-align:center; grid-column:1/-1;">No se encontraron inmuebles.</p>';
                else listContainer.innerHTML = html;
            } catch (error) { console.error(error); }
        },

        saveProperty: async (e) => {
            e.preventDefault();
            const editId = document.getElementById('edit-id').value;
            const btn = document.getElementById('btn-save-modal');
            btn.disabled = true;
            btn.innerText = editId ? 'Actualizando...' : 'Guardando...';

            const rawImages = document.getElementById('img').value;
            const imagesArray = rawImages.split('\n').map(url => url.trim()).filter(url => url !== '');
            const currentRef = document.getElementById('ref-number').value;

            const formData = {
                ref: currentRef,
                title: document.getElementById('title').value,
                price: Number(document.getElementById('price').value),
                period: document.getElementById('period').value,
                type: document.getElementById('type').value,
                status: document.getElementById('status').value,
                category: document.getElementById('category').value,
                location: document.getElementById('location').value,
                beds: Number(document.getElementById('beds').value),
                baths: Number(document.getElementById('baths').value),
                img: imagesArray,
                desc: document.getElementById('desc').value,
            };

            try {
                if (editId) {
                    await updateDoc(doc(db, "properties", editId), formData);
                    showToast('Inmueble actualizado');
                } else {
                    await addDoc(collection(db, "properties"), { ...formData, createdAt: new Date() });
                    showToast('Inmueble creado');
                }
                adminApp.closePropertyModal();
                adminApp.renderInmuebles();
            } catch (error) { console.error(error); showToast('Error', 'error'); }
            finally { btn.disabled = false; btn.innerText = editId ? 'Actualizar' : 'Guardar'; }
        },

        deleteProperty: async (id) => {
            if(!confirm('¿Eliminar inmueble?')) return;
            try { await deleteDoc(doc(db, "properties", id)); showToast('Eliminado'); adminApp.renderInmuebles(); } catch(e) { showToast('Error', 'error'); }
        },

        // --- MENSAJES ---
        renderMessages: async () => {
            const container = document.getElementById('messages-container');
            container.innerHTML = '<p>Cargando...</p>';
            try {
                const q = query(collection(db, "messages"), orderBy("date", "desc"));
                const snap = await getDocs(q);
                
                const cSnap = await getDocs(collection(db, "clients"));
                const clientMap = new Map();
                cSnap.forEach(c => {
                    const data = c.data();
                    clientMap.set(data.email, true);
                    if(data.phone) clientMap.set(data.phone, true);
                });

                if(snap.empty) { container.innerHTML = '<p>No hay mensajes.</p>'; return; }

                let html = '';
                snap.forEach(d => {
                    const m = d.data();
                    const isRead = m.read === true;
                    const date = adminApp.formatSafeDate(m.date);
                    
                    const isTracked = clientMap.has(m.clientEmail) || clientMap.has(m.clientPhone);
                    const addBtnState = isTracked ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : `onclick="adminApp.addToTracking('${d.id}')"`;
                    const addBtnText = isTracked ? 'En Seguimiento' : 'Añadir a Seguimiento';

                    html += `
                        <div class="message-item ${isRead ? 'read' : 'unread'}">
                            <div class="msg-info">
                                <h4>${m.clientName} <small>(${m.clientEmail})</small> ${!isRead ? '<span style="color:var(--accent); font-size:0.7rem;">NUEVO</span>' : ''}</h4>
                                <p style="margin:5px 0; color:#444;">${m.message}</p>
                                <small><i class="fas fa-phone"></i> ${m.clientPhone} • ${date}</small>
                                <div style="font-size:0.8rem; color:var(--primary); margin-top:2px;">Interés: ${m.propName} ${m.propRef ? `(${m.propRef})` : ''}</div>
                            </div>
                            <div style="text-align:right;">
                                <div class="msg-actions">
                                    <button class="btn-xs btn-read" onclick="adminApp.toggleRead('${d.id}', ${!isRead})">
                                        ${isRead ? 'Marcar No Leído' : 'Marcar Leído'}
                                    </button>
                                    <button class="btn-xs btn-delete" onclick="adminApp.deleteMessage('${d.id}')"><i class="fas fa-trash"></i></button>
                                </div>
                                <button class="btn-xs btn-add-client" style="margin-top:5px; width:100%;" ${addBtnState}>
                                    ${addBtnText}
                                </button>
                            </div>
                        </div>
                    `;
                });
                container.innerHTML = html;
            } catch(e) { console.error(e); }
        },

        toggleRead: async (id, status) => {
            try { await updateDoc(doc(db, "messages", id), { read: status }); adminApp.renderMessages(); } catch(e) { console.error(e); }
        },

        deleteMessage: async (id) => {
            if(!confirm('¿Eliminar mensaje?')) return;
            try { await deleteDoc(doc(db, "messages", id)); adminApp.renderMessages(); showToast('Eliminado'); } catch(e) { console.error(e); }
        },

        deleteAllMessages: async () => {
            if(!confirm('⚠️ ESTÁS A PUNTO DE BORRAR TODOS LOS MENSAJES. ¿Continuar?')) return;
            try {
                const snap = await getDocs(collection(db, "messages"));
                const batch = snap.docs.map(d => deleteDoc(doc(db, "messages", d.id)));
                await Promise.all(batch);
                showToast('Todos los mensajes eliminados');
                adminApp.renderMessages();
            } catch(e) { console.error(e); showToast('Error al borrar todo', 'error'); }
        },

        // --- CLIENTES / SEGUIMIENTO ---
        addToTracking: async (msgId) => {
            try {
                const mSnap = await getDocs(query(collection(db, "messages"), where("__name__", "==", msgId)));
                if(mSnap.empty) return;
                const msg = mSnap.docs[0].data();

                await addDoc(collection(db, "clients"), {
                    name: msg.clientName,
                    email: msg.clientEmail,
                    phone: msg.clientPhone,
                    notes: `Interés inicial en: ${msg.propName} ${msg.propRef ? `(${msg.propRef})` : ''}. Mensaje: "${msg.message}"`,
                    createdAt: new Date()
                });
                showToast('Cliente añadido a seguimiento');
                adminApp.renderMessages();
            } catch(e) { console.error(e); showToast('Error', 'error'); }
        },

        addManualClient: async () => {
            const name = document.getElementById('new-client-name').value;
            const email = document.getElementById('new-client-email').value;
            const phone = document.getElementById('new-client-phone').value;

            if(!name || !email) return alert('Nombre y Email requeridos');

            try {
                await addDoc(collection(db, "clients"), {
                    name, email, phone, notes: 'Añadido manualmente', createdAt: new Date()
                });
                showToast('Cliente creado');
                document.getElementById('new-client-name').value = '';
                document.getElementById('new-client-email').value = '';
                document.getElementById('new-client-phone').value = '';
                document.getElementById('add-client-form').style.display = 'none';
                adminApp.renderClients();
            } catch(e) { console.error(e); }
        },

        renderClients: async () => {
            const container = document.getElementById('clients-container');
            container.innerHTML = '<p>Cargando clientes...</p>';
            try {
                const q = query(collection(db, "clients"), orderBy("createdAt", "desc"));
                const snap = await getDocs(q);
                
                if(snap.empty) { container.innerHTML = '<p>No hay clientes en seguimiento.</p>'; return; }

                let html = '';
                snap.forEach(d => {
                    const c = d.data();
                    const createdDate = adminApp.formatSafeDate(c.createdAt);

                    html += `
                        <div class="client-card">
                            <div class="client-header">
                                <h4 style="margin:0;">${c.name}</h4>
                                <small>${createdDate}</small>
                            </div>
                            <p style="font-size:0.9rem; color:#666; margin-bottom:5px;"><i class="fas fa-envelope"></i> ${c.email}</p>
                            <p style="font-size:0.9rem; color:#666;"><i class="fas fa-phone"></i> ${c.phone || 'N/A'}</p>
                            <div class="client-notes">
                                <strong>Notas:</strong><br>
                                ${c.notes || 'Sin notas.'}
                            </div>
                            <button class="btn btn-outline" style="width:100%; margin-top:10px; font-size:0.8rem; padding:5px;" onclick="adminApp.editClientNote('${d.id}')">
                                <i class="fas fa-edit"></i> Añadir Nota
                            </button>
                            <button class="btn btn-danger" style="width:100%; margin-top:5px; font-size:0.8rem; padding:5px;" onclick="adminApp.deleteClient('${d.id}')">
                                Eliminar
                            </button>
                        </div>
                    `;
                });
                container.innerHTML = html;
            } catch(e) { console.error(e); }
        },

        editClientNote: async (id) => {
            try {
                const docRef = doc(db, "clients", id);
                const docSnap = await getDoc(docRef);

                if (!docSnap.exists()) {
                    showToast('Error: Cliente no encontrado', 'error');
                    return;
                }

                const clientData = docSnap.data();
                const currentNotes = clientData.notes || "Sin notas previas.";

                const newNote = prompt(`Notas actuales:\n${currentNotes}\n\n--------------------------------\nEscribe la nueva nota a añadir abajo:`);

                if (newNote && newNote.trim() !== "") {
                    const timestamp = new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString();
                    const updatedNotes = `${currentNotes}\n\n[${timestamp}]:\n${newNote}`;

                    await updateDoc(docRef, { notes: updatedNotes });
                    
                    showToast('Nota añadida correctamente');
                    adminApp.renderClients();
                }
            } catch (error) {
                console.error("Error añadiendo nota:", error);
                showToast('Error al guardar la nota', 'error');
            }
        },

        deleteClient: async (id) => {
            if(!confirm('¿Eliminar cliente del seguimiento?')) return;
            try { await deleteDoc(doc(db, "clients", id)); adminApp.renderClients(); } catch(e) { console.error(e); }
        },

        // --- UTILIDAD DE FECHA ---
        formatSafeDate: (dateInput) => {
            if (!dateInput) return 'Sin fecha';
            let dateObj;
            if (dateInput && typeof dateInput.toDate === 'function') {
                dateObj = dateInput.toDate();
            } else {
                dateObj = new Date(dateInput);
            }
            if (isNaN(dateObj.getTime())) {
                return typeof dateInput === 'string' ? dateInput : 'Formato desconocido';
            }
            return dateObj.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
        }
    };

    window.adminApp = adminApp;
    document.addEventListener('DOMContentLoaded', adminApp.init);
}