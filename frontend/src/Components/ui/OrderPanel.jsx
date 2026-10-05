import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "../../context/AuthContext";
import { hasMinimumPlan } from "../../utils/subscriptionPlans";

import {
  Armchair,
  Banknote,
  ChevronRight,
  CreditCard,
  MapPin,
  Minus,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  Trash2,
  X,
  XCircle,
} from "lucide-react";

import { PRODUCT_CATEGORIES } from "../../constants/productCategories";

import { getProducts } from "../../services/productService";

import {
  addItemsToOrder,
  cancelOrder,
  createOrder,
  getOrderById,
  payOrder,
  releaseOrderComplimentary,
  updateOrder,
  updateOrderStatus,
} from "../../services/orderService";

import "./OrderPanel.css";
import "./ComplimentaryModal.css";

function OrderPanel({ table, onClose, onOrderSaved }) {
  const { t } = useTranslation();

  const { subscription } = useAuth();

  const canUseComplimentary = hasMinimumPlan(
    subscription?.plan || "none",
    "pro",
  );
  const [products, setProducts] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [newOrderItems, setNewOrderItems] = useState([]);

  const [currentOrderId, setCurrentOrderId] = useState(null);
  const [currentOrderStatus, setCurrentOrderStatus] = useState("draft");

  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const [paymentMethod, setPaymentMethod] = useState("cash");

  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingOrder, setLoadingOrder] = useState(false);

  const [sendingToKitchen, setSendingToKitchen] = useState(false);

  const [savingOrder, setSavingOrder] = useState(false);
  const [payingOrder, setPayingOrder] = useState(false);
  const [cancellingOrder, setCancellingOrder] = useState(false);
  const [complimentaryOpen, setComplimentaryOpen] = useState(false);
  const [complimentaryPin, setComplimentaryPin] = useState("");
  const [complimentaryReason, setComplimentaryReason] = useState("");
  const [releasingComplimentary, setReleasingComplimentary] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (!table) {
      return;
    }

    async function loadPanelData() {
      try {
        setLoadingProducts(true);
        setLoadingOrder(true);
        setError("");
        setSuccessMessage("");

        const productsData = await getProducts();

        const productsList = Array.isArray(productsData)
          ? productsData
          : productsData?.products || [];

        setProducts(productsList);

        if (table.active_order_id) {
          const existingOrder = await getOrderById(table.active_order_id);

          setCurrentOrderId(existingOrder.id);

          setCurrentOrderStatus(existingOrder.status || "draft");

          setOrderItems(
            existingOrder.items.map((item) => {
              const matchingProduct = productsList.find(
                (product) => getProductId(product) === item.product_id,
              );

              return {
                productId: item.product_id,
                name: item.name,
                price: Number(item.price),
                quantity: item.quantity,
                stock: Number(matchingProduct?.stock ?? 0),
              };
            }),
          );
        } else {
          setCurrentOrderId(null);
          setCurrentOrderStatus("draft");
          setOrderItems([]);
        }
      } catch (err) {
        console.error("Gabim gjatë hapjes së panelit:", err);

        setError(err.message || "Të dhënat nuk mund të ngarkohen.");
      } finally {
        setLoadingProducts(false);
        setLoadingOrder(false);
      }
    }

    setSearchTerm("");
    setActiveCategory("All");
    setPaymentMethod("cash");

    loadPanelData();
  }, [table]);

  const categories = useMemo(() => {
    return ["All", ...PRODUCT_CATEGORIES];
  }, []);

  const filteredProducts = useMemo(() => {
    const searchValue = searchTerm.trim().toLowerCase();

    return products.filter((product) => {
      const productName = String(product.name || "").toLowerCase();

      const productCategory = String(product.category || "").toLowerCase();

      const matchesSearch =
        productName.includes(searchValue) ||
        productCategory.includes(searchValue);

      const matchesCategory =
        activeCategory === "All" || product.category === activeCategory;

      const isActive = product.is_active !== false;

      return matchesSearch && matchesCategory && isActive;
    });
  }, [products, searchTerm, activeCategory]);

  const totalItems = useMemo(() => {
    const oldItems = orderItems.reduce(
      (total, item) => total + item.quantity,
      0,
    );

    const addedItems = newOrderItems.reduce(
      (total, item) => total + item.quantity,
      0,
    );

    return oldItems + addedItems;
  }, [orderItems, newOrderItems]);

  // The order has been sent to the kitchen/bar ("Printer 1").
  // Only then can the table be paid and closed.
  const orderIsPrinted =
    Boolean(currentOrderId) && currentOrderStatus !== "draft";

  const totalNewItems = useMemo(() => {
    return newOrderItems.reduce((total, item) => total + item.quantity, 0);
  }, [newOrderItems]);

  const orderTotal = useMemo(() => {
    const oldTotal = orderItems.reduce(
      (total, item) => total + Number(item.price) * item.quantity,
      0,
    );

    const addedTotal = newOrderItems.reduce(
      (total, item) => total + Number(item.price) * item.quantity,
      0,
    );

    return oldTotal + addedTotal;
  }, [orderItems, newOrderItems]);

  const panelIsLoading = loadingProducts || loadingOrder;

  const actionInProgress =
    savingOrder ||
    payingOrder ||
    cancellingOrder ||
    sendingToKitchen ||
    releasingComplimentary;

  const orderIsEditable = !currentOrderId || currentOrderStatus === "draft";

  function getProductId(product) {
    return product.id || product._id;
  }

  function getTableId(selectedTable) {
    return selectedTable.id || selectedTable._id;
  }

  function resetMessages() {
    setError("");
    setSuccessMessage("");
  }

  async function reloadProducts() {
    const productsData = await getProducts();

    const productsList = Array.isArray(productsData)
      ? productsData
      : productsData?.products || [];

    setProducts(productsList);

    return productsList;
  }

  function handleAddProduct(product) {
    const productId = getProductId(product);
    const stock = Number(product.stock || 0);

    if (!productId) {
      setError(t("orderPanel.invalidProductId"));
      return;
    }

    if (stock <= 0) {
      setError(`${product.name} është jashtë stokut.`);
      return;
    }

    resetMessages();

    // Nëse porosia është dërguar tashmë,
    // produktet e reja ruhen veçmas.
    if (currentOrderId && currentOrderStatus !== "draft") {
      setNewOrderItems((currentItems) => {
        const existingItem = currentItems.find(
          (item) => item.productId === productId,
        );

        if (existingItem) {
          return currentItems.map((item) =>
            item.productId === productId
              ? {
                  ...item,
                  quantity: item.quantity + 1,
                }
              : item,
          );
        }

        return [
          ...currentItems,
          {
            productId,
            name: product.name,
            price: Number(product.price),
            quantity: 1,
            stock,
          },
        ];
      });

      return;
    }

    // Nëse është draft, vazhdon normalisht.
    setOrderItems((currentItems) => {
      const existingItem = currentItems.find(
        (item) => item.productId === productId,
      );

      if (existingItem) {
        return currentItems.map((item) =>
          item.productId === productId
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
            : item,
        );
      }

      return [
        ...currentItems,
        {
          productId,
          name: product.name,
          price: Number(product.price),
          quantity: 1,
          stock,
        },
      ];
    });
  }

  function handleIncreaseQuantity(productId) {
    if (!orderIsEditable) {
      setError(t("orderPanel.orderNotEditable"));
      return;
    }

    resetMessages();

    setOrderItems((currentItems) => {
      const existingItem = currentItems.find(
        (item) => item.productId === productId,
      );

      if (!existingItem) {
        return currentItems;
      }

      const product = products.find(
        (currentProduct) => getProductId(currentProduct) === productId,
      );

      const stock = Number(product?.stock ?? existingItem.stock ?? 0);

      if (stock <= 0) {
        setError(`${existingItem.name} është jashtë stokut.`);

        return currentItems;
      }

      if (existingItem.quantity >= stock) {
        setError(
          `Nuk ka mjaftueshëm stok për ${existingItem.name}. Në dispozicion: ${stock}.`,
        );

        return currentItems;
      }

      return currentItems.map((item) =>
        item.productId === productId
          ? {
              ...item,
              quantity: item.quantity + 1,
              stock,
            }
          : item,
      );
    });
  }

  function handleDecreaseQuantity(productId) {
    if (!orderIsEditable) {
      setError(t("orderPanel.orderNotEditable"));
      return;
    }

    resetMessages();

    setOrderItems((currentItems) =>
      currentItems
        .map((item) =>
          item.productId === productId
            ? {
                ...item,
                quantity: item.quantity - 1,
              }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  function handleRemoveItem(productId) {
    if (!orderIsEditable) {
      setError(t("orderPanel.orderNotEditable"));
      return;
    }

    resetMessages();

    setOrderItems((currentItems) =>
      currentItems.filter((item) => item.productId !== productId),
    );
  }

  function handleClearOrder() {
    if (!orderIsEditable) {
      setError(t("orderPanel.orderNotEditable"));
      return;
    }

    setOrderItems([]);
    resetMessages();
  }
  function handleIncreaseNewItem(productId) {
    resetMessages();

    setNewOrderItems((currentItems) =>
      currentItems.map((item) => {
        if (item.productId !== productId) {
          return item;
        }

        const product = products.find(
          (currentProduct) => getProductId(currentProduct) === productId,
        );

        const stock = Number(product?.stock ?? item.stock ?? 0);

        if (item.quantity >= stock) {
          setError(
            `Nuk ka mjaftueshëm stok për ${item.name}. Në dispozicion: ${stock}.`,
          );

          return item;
        }

        return {
          ...item,
          quantity: item.quantity + 1,
          stock,
        };
      }),
    );
  }

  function handleDecreaseNewItem(productId) {
    resetMessages();

    setNewOrderItems((currentItems) =>
      currentItems
        .map((item) =>
          item.productId === productId
            ? {
                ...item,
                quantity: item.quantity - 1,
              }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  function handleRemoveNewItem(productId) {
    resetMessages();

    setNewOrderItems((currentItems) =>
      currentItems.filter((item) => item.productId !== productId),
    );
  }

  function createItemsPayload() {
    return orderItems.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
    }));
  }

  async function refreshTables(savedOrder) {
    if (typeof onOrderSaved === "function") {
      await onOrderSaved(savedOrder);
    }
  }

  async function handleSaveOrder() {
    if (!table) {
      setError(t("orderPanel.tableNotSelected"));
      return;
    }

    if (!orderIsEditable) {
      setError(t("orderPanel.onlyDraftEditable"));
      return;
    }

    if (orderItems.length === 0) {
      setError(t("orderPanel.addAtLeastOneProduct"));
      return;
    }

    const tableId = getTableId(table);

    if (!tableId) {
      setError(t("orderPanel.tableIdMissing"));
      return;
    }

    try {
      setSavingOrder(true);
      resetMessages();

      const items = createItemsPayload();

      let savedOrder;

      if (currentOrderId) {
        savedOrder = await updateOrder(currentOrderId, {
          items,
        });
      } else {
        savedOrder = await createOrder({
          table_id: tableId,
          items,
        });

        setCurrentOrderId(savedOrder.id);
      }

      setCurrentOrderStatus(savedOrder.status || "draft");

      await refreshTables(savedOrder);

      setSuccessMessage(
        currentOrderId
          ? t("orderPanel.orderUpdated", {
              total: Number(savedOrder.total).toFixed(2),
            })
          : t("orderPanel.orderSaved", {
              total: Number(savedOrder.total).toFixed(2),
            }),
      );

      window.setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      console.error("Gabim gjatë ruajtjes:", err);

      setError(err.message || "Porosia nuk mund të ruhet.");
    } finally {
      setSavingOrder(false);
    }
  }

  async function handleSendAddedItems() {
    if (!currentOrderId) {
      setError(t("orderPanel.noActiveOrder"));
      return;
    }

    if (newOrderItems.length === 0) {
      setError(t("orderPanel.addAtLeastOneNewProduct"));
      return;
    }

    try {
      setSavingOrder(true);
      resetMessages();

      const items = newOrderItems.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
      }));

      const updatedOrder = await addItemsToOrder(currentOrderId, items);

      setOrderItems(
        updatedOrder.items.map((item) => ({
          productId: item.product_id,
          name: item.name,
          price: Number(item.price),
          quantity: item.quantity,
        })),
      );

      setNewOrderItems([]);

      setCurrentOrderStatus(updatedOrder.status || "sent_to_kitchen");

      await reloadProducts();
      await refreshTables(updatedOrder);

      setSuccessMessage(
        t("orderPanel.addedItemsSent", {
          total: Number(updatedOrder.total).toFixed(2),
        }),
      );
    } catch (err) {
      console.error("Gabim gjatë shtimit të produkteve:", err);

      setError(err.message || "Produktet shtesë nuk mund të dërgohen.");
    } finally {
      setSavingOrder(false);
    }
  }

  async function handleSendToKitchen() {
    if (!currentOrderId) {
      setError(t("orderPanel.saveBeforeSending"));
      return;
    }

    if (currentOrderStatus !== "draft") {
      setError(t("orderPanel.onlyDraftSendable"));
      return;
    }

    try {
      setSendingToKitchen(true);
      resetMessages();

      // Save the latest items first, so "Send" also works without
      // pressing a separate "Save draft" button.
      if (orderItems.length > 0) {
        await updateOrder(currentOrderId, {
          items: createItemsPayload(),
        });
      }

      const updatedOrder = await updateOrderStatus(
        currentOrderId,
        "sent_to_kitchen",
      );

      setCurrentOrderStatus(updatedOrder.status);

      /*
       * Send Order e zbret stock-un në backend.
       * Prandaj e rifreskojmë listën e produkteve
       * që frontend-i ta shfaqë stock-un e ri.
       */
      await reloadProducts();

      await refreshTables(updatedOrder);

      setSuccessMessage(t("orderPanel.orderSent"));
    } catch (err) {
      console.error("Gabim gjatë dërgimit të porosisë:", err);

      setError(err.message || "Porosia nuk mund të dërgohet.");
    } finally {
      setSendingToKitchen(false);
    }
  }

  async function handlePrintOrder() {
    // Already printed: print only the items added since then.
    if (orderIsPrinted) {
      await handleSendAddedItems();
      return;
    }

    if (totalItems === 0) {
      setError(t("orderPanel.addAtLeastOneProduct"));
      return;
    }

    try {
      setSendingToKitchen(true);
      resetMessages();

      let orderId = currentOrderId;

      if (!orderId) {
        const tableId = getTableId(table);

        if (!tableId) {
          setError(t("orderPanel.tableIdMissing"));
          return;
        }

        const createdOrder = await createOrder({
          table_id: tableId,
          items: createItemsPayload(),
        });

        orderId = createdOrder.id;
        setCurrentOrderId(orderId);
      } else {
        // Draft: save the latest items before printing.
        await updateOrder(orderId, {
          items: createItemsPayload(),
        });
      }

      const printedOrder = await updateOrderStatus(
        orderId,
        "sent_to_kitchen",
      );

      setCurrentOrderStatus(printedOrder.status);

      // Sending deducts stock in the backend, so reload products.
      await reloadProducts();
      await refreshTables(printedOrder);

      setSuccessMessage(t("orderPanel.orderSent"));
    } catch (err) {
      console.error("Gabim gjatë shtypjes së porosisë:", err);

      setError(err.message || "Porosia nuk mund të shtypet.");
    } finally {
      setSendingToKitchen(false);
    }
  }

  async function handlePayOrder() {
    if (totalItems === 0) {
      setError(t("orderPanel.addAtLeastOneProduct"));
      return;
    }

    try {
      setPayingOrder(true);
      resetMessages();

      let orderId = currentOrderId;

      if (!orderId) {
        // New order: create it, then pay right away.
        const tableId = getTableId(table);

        if (!tableId) {
          setError(t("orderPanel.tableIdMissing"));
          return;
        }

        const createdOrder = await createOrder({
          table_id: tableId,
          items: createItemsPayload(),
        });

        orderId = createdOrder.id;
        setCurrentOrderId(orderId);
        setCurrentOrderStatus(createdOrder.status || "draft");
      } else if (currentOrderStatus === "draft") {
        // Save the latest changes before paying.
        await updateOrder(orderId, {
          items: createItemsPayload(),
        });
      } else if (newOrderItems.length > 0) {
        // Items added to an order that was already sent.
        await addItemsToOrder(
          orderId,
          newOrderItems.map((item) => ({
            product_id: item.productId,
            quantity: item.quantity,
          })),
        );

        setNewOrderItems([]);
      }

      const paidOrder = await payOrder(orderId, paymentMethod);

      await reloadProducts();
      await refreshTables(paidOrder);

      setSuccessMessage(
        t("orderPanel.paymentCompleted", {
          method: t(`orderPanel.${paymentMethod === "cash" ? "cash" : "card"}`),
          total: Number(paidOrder.total).toFixed(2),
        }),
      );

      window.setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      console.error("Gabim gjatë pagesës:", err);

      setError(err.message || "Pagesa nuk mund të përfundohet.");
    } finally {
      setPayingOrder(false);
    }
  }

  async function handleComplimentaryRelease(event) {
    event.preventDefault();

    if (!currentOrderId) {
      setError(t("complimentary.noActiveOrder"));
      return;
    }

    if (!/^\d{4}$/.test(complimentaryPin)) {
      setError(t("complimentary.pinInvalid"));
      return;
    }

    if (complimentaryReason.trim().length < 3) {
      setError(t("complimentary.reasonRequired"));
      return;
    }

    try {
      setReleasingComplimentary(true);
      resetMessages();

      const releasedOrder = await releaseOrderComplimentary(
        currentOrderId,
        {
          admin_pin: complimentaryPin,
          reason: complimentaryReason.trim(),
        },
      );

      await reloadProducts();
      await refreshTables(releasedOrder);

      setComplimentaryOpen(false);
      setComplimentaryPin("");
      setComplimentaryReason("");
      setSuccessMessage(t("complimentary.success"));

      window.setTimeout(() => {
        onClose();
      }, 1100);
    } catch (err) {
      console.error("Complimentary release error:", err);
      setError(err.message || t("complimentary.error"));
    } finally {
      setReleasingComplimentary(false);
    }
  }

  async function handleCancelOrder() {
    if (!currentOrderId) {
      // Nothing saved yet: just discard and close.
      setOrderItems([]);
      setNewOrderItems([]);
      onClose();
      return;
    }

    const confirmed = window.confirm(
      t("orderPanel.cancelConfirm"),
    );

    if (!confirmed) {
      return;
    }

    try {
      setCancellingOrder(true);
      resetMessages();

      const cancelledOrder = await cancelOrder(currentOrderId);

      /*
       * Cancel Order e rikthen stock-un
       * në backend, prandaj rifreskojmë
       * edhe produktet.
       */
      await reloadProducts();

      await refreshTables(cancelledOrder);

      setSuccessMessage(
        t("orderPanel.cancelSuccess"),
      );

      window.setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      console.error("Gabim gjatë anulimit të porosisë:", err);

      setError(err.message || "Porosia nuk mund të anulohet.");
    } finally {
      setCancellingOrder(false);
    }
  }

  if (!table) {
    return null;
  }

  return (
    <div
      className="order-panel-overlay"
      onClick={actionInProgress ? undefined : onClose}
    >
      <aside
        className="order-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="order-panel-header">
          <div>
            <p className="order-panel-eyebrow">
              {currentOrderId
                ? t("orderPanel.orderStatusLabel", {
                    status: t(`orderPanel.status.${currentOrderStatus}`, {
                      defaultValue: currentOrderStatus.replaceAll("_", " "),
                    }),
                  })
                : t("orderPanel.newOrder")}
            </p>

            <h2>{t("orderPanel.tableTitle", { number: table.number })}</h2>
          </div>

          <div className="order-panel-header-actions">
            {currentOrderId && canUseComplimentary && (
              <button
                type="button"
                className="complimentary-header-button"
                disabled={actionInProgress}
                onClick={() => {
                  resetMessages();
                  setComplimentaryPin("");
                  setComplimentaryReason("");
                  setComplimentaryOpen(true);
                }}
              >
                {t("complimentary.releaseButton")}
              </button>
            )}

            <button
              type="button"
              className="order-panel-close"
              onClick={onClose}
              disabled={actionInProgress}
            >
              <X size={22} />
            </button>
          </div>
        </header>

        <div className="order-table-info">
          <div className="order-table-icon">
            <Armchair size={27} />
          </div>

          <div className="order-table-text">
            <h3>{t("orderPanel.tableTitle", { number: table.number })}</h3>

            <p>
              <MapPin size={15} />
              {table.zone}
            </p>
          </div>

          <span className={`order-status order-status-${table.status}`}>
            {table.status}
          </span>
        </div>

        {error && (
          <div className="order-api-message order-api-error">{error}</div>
        )}

        {successMessage && (
          <div className="order-api-message order-api-success">
            {successMessage}
          </div>
        )}

        <div className="order-workspace">
          <section className="products-section">
            <div className="product-search">
              <Search size={18} />

              <input
                type="text"
                value={searchTerm}
                placeholder={t("orderPanel.searchProducts")}
                onChange={(event) => setSearchTerm(event.target.value)}
              />

              {searchTerm && (
                <button type="button" onClick={() => setSearchTerm("")}>
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="category-list">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={
                    activeCategory === category
                      ? "category-button category-button-active"
                      : "category-button"
                  }
                  onClick={() => setActiveCategory(category)}
                >
                  {category === "All" ? t("orderPanel.all") : t(`products.categoriesFilter.${category}`, { defaultValue: category })}
                </button>
              ))}
            </div>

            {panelIsLoading ? (
              <div className="order-loading">
                {t("orderPanel.loading")}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="order-loading">
                {t("orderPanel.noProductsInCategory")}
              </div>
            ) : (
              <div className="products-order-grid">
                {filteredProducts.map((product) => {
                  const productId = getProductId(product);

                  const productInOrder = newOrderItems.find(
                    (item) => item.productId === productId,
                  );

                  const stock = Number(product.stock || 0);

                  const isOutOfStock = stock <= 0;

                  const isLowStock = stock > 0 && stock <= 10;

                  const selectedQuantity = productInOrder?.quantity || 0;

                  const reachedStockLimit = selectedQuantity >= stock;

                  return (
                    <button
                      key={productId}
                      type="button"
                      className={
                        isOutOfStock
                          ? "order-product-card order-product-card-out"
                          : "order-product-card"
                      }
                      disabled={
                        actionInProgress || isOutOfStock || reachedStockLimit
                      }
                      onClick={() => handleAddProduct(product)}
                    >
                      <div className="order-product-top">
                        <span className="product-category">
                          {t(`products.categoriesFilter.${product.category}`, { defaultValue: product.category })}
                        </span>

                        {productInOrder && (
                          <span className="product-quantity-badge">
                            {productInOrder.quantity}
                          </span>
                        )}
                      </div>

                      <h3>{product.name}</h3>

                      {isOutOfStock ? (
                        <span className="order-stock-status order-stock-out">
                          {t("orderPanel.outOfStockLabel")}
                        </span>
                      ) : isLowStock ? (
                        <span className="order-stock-status order-stock-low">
                          {t("orderPanel.onlyLeft", { count: stock })}
                        </span>
                      ) : (
                        <span className="order-stock-status order-stock-good">
                          {t("orderPanel.stockLabel", { count: stock })}
                        </span>
                      )}

                      <div className="order-product-bottom">
                        <strong>€{Number(product.price).toFixed(2)}</strong>

                        <span className="add-product-icon">
                          <Plus size={17} />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="cart-section">
            <div className="cart-header">
              <div>
                <h3>{t("orderPanel.currentOrder")}</h3>

                <p>
                  {totalItems} {t("orderPanel.items")}
                </p>
              </div>

              {orderItems.length > 0 && (
                <button
                  type="button"
                  className="clear-order-button"
                  disabled={actionInProgress || !orderIsEditable}
                  onClick={handleClearOrder}
                >
                  {t("orderPanel.clear")}
                </button>
              )}
            </div>

            {orderItems.length === 0 ? (
              <div className="empty-order">
                <div className="empty-order-icon">
                  <ShoppingCart size={32} />
                </div>

                <h3>{t("orderPanel.noProductsAdded")}</h3>
              </div>
            ) : (
              <div className="order-items-list">
                {orderItems.map((item) => {
                  const product = products.find(
                    (currentProduct) =>
                      getProductId(currentProduct) === item.productId,
                  );

                  const availableStock = Number(
                    product?.stock ?? item.stock ?? 0,
                  );

                  const maxReached = item.quantity >= availableStock;

                  return (
                    <article key={item.productId} className="order-item">
                      <div className="order-item-main">
                        <div>
                          <h4>{item.name}</h4>

                          <p>€{item.price.toFixed(2)}</p>

                          {availableStock <= 10 ? (
                            <small className="order-item-stock-warning">
                              {t("orderPanel.stockLabel", { count: availableStock })}
                            </small>
                          ) : null}
                        </div>

                        <strong>
                          €{(item.price * item.quantity).toFixed(2)}
                        </strong>
                      </div>

                      <div className="order-item-actions">
                        <div className="quantity-controls">
                          <button
                            type="button"
                            disabled={actionInProgress || !orderIsEditable}
                            onClick={() =>
                              handleDecreaseQuantity(item.productId)
                            }
                          >
                            <Minus size={15} />
                          </button>

                          <span>{item.quantity}</span>

                          <button
                            type="button"
                            disabled={actionInProgress || maxReached}
                            onClick={() => {
                              if (orderIsEditable) {
                                handleIncreaseQuantity(item.productId);
                              } else if (product) {
                                handleAddProduct(product);
                              }
                            }}
                          >
                            <Plus size={15} />
                          </button>
                        </div>

                        <button
                          type="button"
                          className="remove-order-item"
                          disabled={actionInProgress || !orderIsEditable}
                          onClick={() => handleRemoveItem(item.productId)}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
            {currentOrderId &&
              currentOrderStatus !== "draft" &&
              newOrderItems.length > 0 && (
                <div className="added-items-section">
                  <div className="added-items-header">
                    <div>
                      <h4>{t("orderPanel.newItems")}</h4>
                      <p>{t("orderPanel.notSentYetDescription")}</p>
                    </div>

                    <span>{totalNewItems}</span>
                  </div>

                  <div className="order-items-list">
                    {newOrderItems.map((item) => {
                      const product = products.find(
                        (currentProduct) =>
                          getProductId(currentProduct) === item.productId,
                      );

                      const availableStock = Number(
                        product?.stock ?? item.stock ?? 0,
                      );

                      const maxReached = item.quantity >= availableStock;

                      return (
                        <article
                          key={`new-${item.productId}`}
                          className="order-item new-order-item"
                        >
                          <div className="order-item-main">
                            <div>
                              <h4>{item.name}</h4>

                              <p>€{Number(item.price).toFixed(2)}</p>

                              <small className="new-item-label">
                                {t("orderPanel.notSentYet")}
                              </small>
                            </div>

                            <strong>
                              €{(Number(item.price) * item.quantity).toFixed(2)}
                            </strong>
                          </div>

                          <div className="order-item-actions">
                            <div className="quantity-controls">
                              <button
                                type="button"
                                disabled={actionInProgress}
                                onClick={() =>
                                  handleDecreaseNewItem(item.productId)
                                }
                              >
                                <Minus size={15} />
                              </button>

                              <span>{item.quantity}</span>

                              <button
                                type="button"
                                disabled={actionInProgress || maxReached}
                                onClick={() =>
                                  handleIncreaseNewItem(item.productId)
                                }
                              >
                                <Plus size={15} />
                              </button>
                            </div>

                            <button
                              type="button"
                              className="remove-order-item"
                              disabled={actionInProgress}
                              onClick={() =>
                                handleRemoveNewItem(item.productId)
                              }
                            >
                              <Trash2 size={17} />
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}
            {orderIsPrinted && (
              <div className="category-list">
                <button
                  type="button"
                  className={
                    paymentMethod === "cash"
                      ? "category-button category-button-active"
                      : "category-button"
                  }
                  onClick={() => setPaymentMethod("cash")}
                >
                  <Banknote size={16} />
                  {t("orderPanel.cash")}
                </button>

                <button
                  type="button"
                  className={
                    paymentMethod === "card"
                      ? "category-button category-button-active"
                      : "category-button"
                  }
                  onClick={() => setPaymentMethod("card")}
                >
                  <CreditCard size={16} />
                  {t("orderPanel.card")}
                </button>
              </div>
            )}
          </section>
        </div>

        <footer className="order-panel-footer">
          <div className="order-total-row">
            <div>
              <span>{t("orderPanel.total")}</span>

              <small>
                {totalItems} {t("orderPanel.items")}
              </small>
            </div>

            <strong>€{orderTotal.toFixed(2)}</strong>
          </div>

          <button
            type="button"
            className="send-kitchen-button"
            disabled={
              actionInProgress ||
              (orderIsPrinted ? newOrderItems.length === 0 : totalItems === 0)
            }
            onClick={handlePrintOrder}
          >
            <Printer size={18} />

            {sendingToKitchen || savingOrder
              ? t("orderPanel.sending")
              : orderIsPrinted && newOrderItems.length > 0
                ? t("orderPanel.printNewItems", { count: totalNewItems })
                : t("orderPanel.printOrder")}
          </button>

          {orderIsPrinted ? (
            <button
              type="button"
              className="save-order-button"
              disabled={totalItems === 0 || actionInProgress}
              onClick={handlePayOrder}
            >
              {payingOrder
                ? t("orderPanel.processingPayment")
                : t("orderPanel.payWith", {
                    method: t(
                      `orderPanel.${paymentMethod === "cash" ? "cash" : "card"}`,
                    ),
                  })}
            </button>
          ) : (
            <button
              type="button"
              className="save-order-button"
              disabled={totalItems === 0 || actionInProgress}
              onClick={handleSaveOrder}
            >
              {savingOrder ? t("orderPanel.saving") : t("orderPanel.saveDraft")}
            </button>
          )}

          <button
            type="button"
            className="cancel-order-button"
            disabled={actionInProgress}
            onClick={handleCancelOrder}
          >
            <XCircle size={18} />

            {cancellingOrder
              ? t("orderPanel.cancelling")
              : t("orderPanel.cancelOrder")}
          </button>
        </footer>

        {canUseComplimentary && complimentaryOpen && (
          <div
            className="complimentary-modal-overlay"
            onClick={
              releasingComplimentary
                ? undefined
                : () => setComplimentaryOpen(false)
            }
          >
            <form
              className="complimentary-modal"
              onSubmit={handleComplimentaryRelease}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="complimentary-modal-header">
                <div>
                  <span>{t("complimentary.eyebrow")}</span>
                  <h3>{t("complimentary.title")}</h3>
                </div>

                <button
                  type="button"
                  className="complimentary-modal-close"
                  disabled={releasingComplimentary}
                  onClick={() => setComplimentaryOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <p className="complimentary-modal-description">
                {t("complimentary.description")}
              </p>

              <label className="complimentary-field">
                <span>{t("complimentary.adminPin")}</span>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  autoComplete="off"
                  value={complimentaryPin}
                  onChange={(event) =>
                    setComplimentaryPin(
                      event.target.value.replace(/\D/g, "").slice(0, 4),
                    )
                  }
                  placeholder="••••"
                />
              </label>

              <label className="complimentary-field">
                <span>{t("complimentary.reason")}</span>
                <textarea
                  rows={3}
                  maxLength={240}
                  value={complimentaryReason}
                  onChange={(event) =>
                    setComplimentaryReason(event.target.value)
                  }
                  placeholder={t("complimentary.reasonPlaceholder")}
                />
              </label>

              <div className="complimentary-warning">
                {t("complimentary.warning")}
              </div>

              <div className="complimentary-modal-actions">
                <button
                  type="button"
                  className="complimentary-secondary"
                  disabled={releasingComplimentary}
                  onClick={() => setComplimentaryOpen(false)}
                >
                  {t("common.cancel")}
                </button>

                <button
                  type="submit"
                  className="complimentary-primary"
                  disabled={releasingComplimentary}
                >
                  {releasingComplimentary
                    ? t("complimentary.processing")
                    : t("complimentary.confirm")}
                </button>
              </div>
            </form>
          </div>
        )}
      </aside>
    </div>
  );
}

export default OrderPanel;
