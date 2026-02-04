const categoryContainer = document.getElementById("categorie");
const productContainer = document.getElementById("product");
const titleEl = document.getElementById("name");
const searchInput = document.getElementById("search");
const openCartBtn = document.getElementById("openCart");
const closeCartBtn = document.getElementById("closeCart");
const cartOverlay = document.getElementById("cartOverlay");
const cartDrawer = document.getElementById("cartDrawer");
const cartItemsEl = document.getElementById("cartItems");
const cartTotalEl = document.getElementById("cartTotal");
const cartCountEl = document.getElementById("cartCount");
const demanderBtn = document.getElementById("demanderBtn");
const toastEl = document.getElementById("toast");
const caractereOverlay = document.getElementById("caractereOverlay");
const caractereModal = document.getElementById("caractereModal");
const caractereClose = document.getElementById("caractereClose");
const caractereImg = document.getElementById("caractereImg");
const caractereOptions = document.getElementById("caractereOptions");

let selectedCategory = "Tous";
let categories = [];
let products = [];
let searchQuery = "";

let cart = [];

const STORAGE_CART_KEY = "sellamo_cart";
const STORAGE_COMMENTS_KEY = "sellamo_comments";
let toastTimerId = null;

function clearElement(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
}

function setCaractereOpen(isOpen) {
    if (!caractereModal || !caractereOverlay) return;
    caractereModal.classList.toggle("open", isOpen);
    caractereOverlay.classList.toggle("open", isOpen);
    caractereModal.setAttribute("aria-hidden", String(!isOpen));
    caractereOverlay.setAttribute("aria-hidden", String(!isOpen));
}

function renderCaractereOptions(caractere) {
    if (!caractereOptions) return;
    caractereOptions.innerHTML = "";
    const raw = String(caractere || "").trim();
    if (!raw) {
        caractereOptions.textContent = "Aucune option";
        return;
    }
    const options = raw.split(/[,;|]/).map((opt) => opt.trim()).filter(Boolean);
    options.forEach((opt, idx) => {
        const label = document.createElement("label");
        const span = document.createElement("span");
        span.textContent = opt;
        label.appendChild(span);
        caractereOptions.appendChild(label);
    });
}

function openCaractereModal(product) {
    if (!product || !caractereModal) return;
    if (caractereImg) {
        caractereImg.src = product.img ? `../img/${product.img}` : "";
        caractereImg.alt = product.idname || "";
    }
    renderCaractereOptions(product.caractere);
    setCaractereOpen(true);
}

if (caractereClose) {
    caractereClose.addEventListener("click", () => setCaractereOpen(false));
}

if (caractereOverlay) {
    caractereOverlay.addEventListener("click", () => setCaractereOpen(false));
}

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setCaractereOpen(false);
});

function getProductKey(product) {
    const raw = product?.id ?? product?.idprod ?? product?.idproduct;
    if (raw !== undefined && raw !== null && String(raw).trim() !== "") return String(raw);
    return `${normalizeCategoryName(product?.idcat)}:${normalizeCategoryName(product?.idname)}`;
}

function safeNumber(value) {
    const n = typeof value === "number" ? value : parseFloat(String(value ?? "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
}

function showToast(message) {
    if (!toastEl) return;
    toastEl.textContent = String(message ?? "");
    toastEl.classList.add("show");
    toastEl.setAttribute("aria-hidden", "false");

    if (toastTimerId) {
        clearTimeout(toastTimerId);
        toastTimerId = null;
    }

    toastTimerId = setTimeout(() => {
        toastEl.classList.remove("show");
        toastEl.setAttribute("aria-hidden", "true");
        toastTimerId = null;
    }, 5000);
}

function makeCartItemId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadPersistedState() {
    try {
        const rawCart = JSON.parse(localStorage.getItem(STORAGE_CART_KEY) || "[]");
        cart = Array.isArray(rawCart) ? rawCart.filter((x) => x && (x.id || x.key || x.productKey)) : [];
    } catch {
        cart = [];
    }

    try {
        const rawComments = JSON.parse(localStorage.getItem(STORAGE_COMMENTS_KEY) || "{}");
        const legacyCommentsByKey = new Map(Object.entries(rawComments || {}));

        // Migrate legacy cart format:
        // - old: [{ key, qty }]
        // - new: [{ id, productKey, name, price, img, comment }]
        if (cart.some((x) => x && (x.qty || x.key))) {
            const migrated = [];
            cart.forEach((entry) => {
                const key = entry.productKey || entry.key;
                const qty = entry.qty || 1;
                const p = key ? getProductByKey(String(key)) : null;
                const comment = key ? legacyCommentsByKey.get(String(key)) || "" : "";
                for (let i = 0; i < qty; i++) {
                    migrated.push({
                        id: makeCartItemId(),
                        productKey: key ? String(key) : "",
                        name: p?.idname ?? "",
                        price: p?.price ?? 0,
                        img: p?.img ?? "",
                        comment,
                    });
                }
            });
            cart = migrated;
            persistCart();
        } else {
            // Normalize new format fields
            cart = cart
                .map((x) => {
                    const productKey = x.productKey || x.key;
                    const p = productKey ? getProductByKey(String(productKey)) : null;
                    return {
                        id: x.id || makeCartItemId(),
                        productKey: productKey ? String(productKey) : "",
                        name: x.name ?? p?.idname ?? "",
                        price: x.price ?? p?.price ?? 0,
                        img: x.img ?? p?.img ?? "",
                        comment: x.comment ?? "",
                    };
                })
                .filter((x) => x.productKey);
            persistCart();
        }
    } catch {
        // ignore legacy comment load failures
    }
}

function persistCart() {
    localStorage.setItem(STORAGE_CART_KEY, JSON.stringify(cart));
}

function addToCart(product, comment) {
    const productKey = getProductKey(product);
    cart.push({
        id: makeCartItemId(),
        productKey,
        name: product?.idname ?? "",
        price: product?.price ?? 0,
        img: product?.img ?? "",
        comment: String(comment ?? ""),
    });
    persistCart();
    renderCart();
}

function removeFromCart(cartItemId) {
    const idx = cart.findIndex((i) => i.id === cartItemId);
    if (idx === -1) return;
    cart.splice(idx, 1);
    persistCart();
    renderCart();
}

function getProductByKey(productKey) {
    return products.find((p) => getProductKey(p) === productKey);
}

function setCartOpen(isOpen) {
    if (!cartDrawer || !cartOverlay) return;
    cartDrawer.classList.toggle("open", isOpen);
    cartOverlay.classList.toggle("open", isOpen);
    cartDrawer.setAttribute("aria-hidden", String(!isOpen));
    cartOverlay.setAttribute("aria-hidden", String(!isOpen));
}

function updateCartBadgeAndTotal() {
    const totalQty = cart.length;
    if (cartCountEl) cartCountEl.textContent = String(totalQty);

    const total = cart.reduce((sum, item) => sum + safeNumber(item.price), 0);
    if (cartTotalEl) cartTotalEl.textContent = `${total.toFixed(2)} DT`;
}

function renderCart() {
    if (!cartItemsEl) return;
    clearElement(cartItemsEl);

    if (cart.length === 0) {
        const empty = document.createElement("div");
        empty.style.color = "#666";
        empty.style.padding = "10px 0";
        empty.textContent = "Panier vide";
        cartItemsEl.appendChild(empty);
        updateCartBadgeAndTotal();
        return;
    }

    cart.forEach((item) => {
        if (!item) return;

        const wrap = document.createElement("div");
        wrap.className = "cart-item";

        const img = document.createElement("img");
        img.className = "cart-thumb";
        img.alt = "";
        img.src = item.img ? `../img/${item.img}` : "";

        const right = document.createElement("div");

        const title = document.createElement("div");
        title.className = "cart-item-title";
        title.textContent = item.name;

        const price = document.createElement("div");
        price.className = "cart-item-price";
        const unit = safeNumber(item.price);
        price.textContent = `${unit.toFixed(2)} DT`;

        const row = document.createElement("div");
        row.className = "cart-item-row";

        const comment = document.createElement("input");
        comment.className = "cart-comment";
        comment.type = "text";
        comment.placeholder = "Votre commentaire...";
        comment.value = item.comment || "";
        comment.addEventListener("input", function () {
            item.comment = this.value;
            persistCart();
        });

        const removeBtn = document.createElement("button");
        removeBtn.className = "cart-remove";
        removeBtn.type = "button";
        removeBtn.textContent = "Supprimer";
        removeBtn.addEventListener("click", () => removeFromCart(item.id));

        row.appendChild(comment);
        row.appendChild(removeBtn);

        right.appendChild(title);
        right.appendChild(price);
        right.appendChild(row);

        wrap.appendChild(img);
        wrap.appendChild(right);
        cartItemsEl.appendChild(wrap);
    });

    updateCartBadgeAndTotal();
}

function normalizeCategoryName(value) {
    if (!value) return "";
    return String(value).trim();
}

function isAllCategory(value) {
    const v = normalizeCategoryName(value).toLowerCase();
    return v === "tous" || v === "all";
}

function createCard(product) {
    const article = document.createElement("article");
    article.className = "card";
    const productKey = getProductKey(product);

    const img = document.createElement("img");
    img.className = "card_img";
    img.alt = "";
    img.src = `../img/${product.img}`;
    img.addEventListener("click", () => openCaractereModal(product));

    const meta = document.createElement("div");
    meta.className = "card__meta";

    const title = document.createElement("div");
    title.className = "card_title";
    title.textContent = product.idname;

    const price = document.createElement("div");
    price.className = "card_price";
    price.textContent = `${product.price} DT`;

    meta.appendChild(title);
    meta.appendChild(price);

    const food = document.createElement("div");
    food.className = "card_food";

    const textarea = document.createElement("textarea");
    textarea.placeholder = "Taper votre comentaire";
    textarea.dataset.productKey = productKey;

    const button = document.createElement("button");
    button.className = "btn btn--primary add-btn";
    const productId = product?.id ?? product?.idprod ?? product?.idproduct ?? product?.idname ?? "";
    if (productId) button.dataset.id = productId;
    button.dataset.productKey = productKey;
    button.textContent = "Ajouter au panier";
    button.addEventListener("click", () => {
        addToCart(product, textarea.value);
        textarea.value = "";
        showToast(`${product.idname} ajouté au panier ✅`);
    });

    food.appendChild(button);
    food.appendChild(textarea);
    

    article.appendChild(img);
    article.appendChild(meta);
    article.appendChild(food);

    return article;
}

function renderCategoryButtons() {
    clearElement(categoryContainer);


    categories.forEach((cat) => {
        const btn = document.createElement("button");
        btn.className = "cat";
        btn.dataset.name = cat.idcat;
        btn.textContent = cat.idcat;
        categoryContainer.appendChild(btn);
    });

    const btns = categoryContainer.querySelectorAll(".cat");
    btns.forEach((btn) => {
        btn.addEventListener("click", function () {
            selectedCategory = normalizeCategoryName(this.dataset.name);
            btns.forEach((b) => b.classList.remove("active"));
            this.classList.add("active");
            renderProducts();
        });
    });

    const initialBtn = Array.from(btns).find((b) => normalizeCategoryName(b.dataset.name) === selectedCategory);
    (initialBtn || btns[0])?.classList.add("active");
}

function renderProducts() {
    clearElement(productContainer);

    const q = String(searchQuery || "").trim().toLowerCase();
    const filteredProducts = q
        ? products.filter((p) => {
              const name = normalizeCategoryName(p.idname).toLowerCase();
              const cat = normalizeCategoryName(p.idcat).toLowerCase();
              return name.includes(q) || cat.includes(q);
          })
        : products;

    if (isAllCategory(selectedCategory)) {
        titleEl.textContent = "";
        productContainer.classList.add("grouped");

        const order = categories.map((c) => c.idcat);
        const grouped = new Map();

        filteredProducts.forEach((p) => {
            const key = normalizeCategoryName(p.idcat);
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key).push(p);
        });

        const keys = [];
        order.forEach((k) => {
            if (grouped.has(k)) keys.push(k);
        });
        grouped.forEach((_v, k) => {
            if (!keys.includes(k)) keys.push(k);
        });

        keys.forEach((catName) => {
            const section = document.createElement("section");
            section.className = "cat-section";

            const h = document.createElement("h2");
            h.className = "cat-title";
            h.textContent = catName;

            const grid = document.createElement("div");
            grid.className = "cat-grid";

            grouped.get(catName).forEach((p) => {
                grid.appendChild(createCard(p));
            });

            section.appendChild(h);
            section.appendChild(grid);
            productContainer.appendChild(section);
        });

        return;
    }

    productContainer.classList.remove("grouped");
    titleEl.textContent = selectedCategory;

    filteredProducts
        .filter((p) => normalizeCategoryName(p.idcat) === selectedCategory)
        .forEach((p) => {
            productContainer.appendChild(createCard(p));
        });
}

async function sendOrder() {
    if (!demanderBtn) return;
    if (cart.length === 0) return;

    const totale = cart.reduce((sum, item) => sum + safeNumber(item.price), 0);
    const items = cart.map((item) => ({
        idname: item.name,
        optionn: item.comment && String(item.comment).trim() !== "" ? String(item.comment) : null,
    }));

    const prevText = demanderBtn.textContent;
    demanderBtn.disabled = true;
    demanderBtn.textContent = "Envoi...";

    try {
        
        const res = await fetch("/demander", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ totale, items }),
        });
        console.log('Received response from /demander:', res);
        
        if (!res.ok) {
            throw new Error(`Request failed (${res.status})`);
        }
        alert("here");
        const data = await res.json();
        if (!data || data.success !== true) {
            throw new Error("Server returned error");
        }

        // emit a socket notification so serveur UI updates in real time
        try {
            if (!window.__sellamo_socket_loading) {
                window.__sellamo_socket_loading = true;
                const s = document.createElement('script');
                // load socket.io client from the admin server (port 4000)
                s.src = 'http://localhost:4000/socket.io/socket.io.js';

                s.onload = () => {
                    try {
                        // explicitly connect to admin socket server (root origin)
                        console.log('Socket.IO client script loaded from http://localhost:4000');
                        window.__sellamo_socket = io('http://localhost:4000');
                        window.__sellamo_socket.on('connect', () => console.log('sellamo socket connected', window.__sellamo_socket.id));
                        window.__sellamo_socket.on('connect_error', (err) => console.error('sellamo socket connect_error', err));
                        window.__sellamo_socket.on('disconnect', (reason) => console.log('sellamo socket disconnected', reason));
                    } catch (_e) {
                        console.log('Failed to initialize sellamo socket.io client', _e);
                    }
                    window.__sellamo_socket_loading = false;
                };
                s.onerror = () => { window.__sellamo_socket_loading = false; };
                document.head.appendChild(s);
            }
            // if socket already available emit immediately, otherwise emit after small delay if initialized
            const emitPayload = { items, totale, timestamp: Date.now() };
            const doEmit = () => { try { window.__sellamo_socket && window.__sellamo_socket.emit('client-new-order', emitPayload); } catch (e) {} };
            if (window.__sellamo_socket) doEmit(); else setTimeout(doEmit, 700);
        } catch (e) {
            // silent
        }

        cart = [];
        persistCart();
        renderCart();

        showToast("Order sent successfully. Please wait a few minutes to receive your order.");
        setCartOpen(false)
    } catch (_err) {
        showToast("Failed to send order. Please try again.");
    } finally {
        demanderBtn.disabled = false;
        demanderBtn.textContent = prevText;
    }
}

Promise.all([fetch("/getdata").then((r) => r.json()), fetch("/product").then((r) => r.json())])
    .then(([cats, prods]) => {
        categories = Array.isArray(cats) ? cats : [];
        products = Array.isArray(prods) ? prods : [];
        // If categories endpoint returned nothing, derive categories from products
        if ((!categories || categories.length === 0) && Array.isArray(products) && products.length > 0) {
            const unique = Array.from(new Set(products.map((p) => normalizeCategoryName(p.idcat)))).filter(Boolean);
            categories = unique.map((idcat) => ({ idcat }));
        }

        // Ensure a 'Tous' (All) category is present so the UI can show grouped view
        if (!categories.find((c) => normalizeCategoryName(c.idcat).toLowerCase() === 'tous')) {
            categories.unshift({ idcat: 'Tous' });
        }

        loadPersistedState();

        if (searchInput) {
            searchInput.addEventListener("input", function () {
                searchQuery = this.value;
                renderProducts();
            });
        }

        if (openCartBtn) openCartBtn.addEventListener("click", () => setCartOpen(true));
        if (closeCartBtn) closeCartBtn.addEventListener("click", () => setCartOpen(false));
        if (cartOverlay) cartOverlay.addEventListener("click", () => setCartOpen(false));
        if (demanderBtn) demanderBtn.addEventListener("click", sendOrder);
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") setCartOpen(false);
        });

        renderCategoryButtons();
        renderProducts();
        renderCart();
    })
    .catch(() => {
        // on fetch failure keep persisted data and attempt to derive categories from persisted products
        categories = [];
        products = [];
        loadPersistedState();
        if (Array.isArray(products) && products.length > 0) {
            const unique = Array.from(new Set(products.map((p) => normalizeCategoryName(p.idcat)))).filter(Boolean);
            categories = unique.map((idcat) => ({ idcat }));
            if (!categories.find((c) => normalizeCategoryName(c.idcat).toLowerCase() === 'tous')) {
                categories.unshift({ idcat: 'Tous' });
            }
        }
        renderCategoryButtons();
        renderProducts();
        renderCart();
    });
