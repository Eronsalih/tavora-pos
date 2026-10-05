import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  Boxes,
  CheckCircle2,
  Coffee,
  Edit3,
  LoaderCircle,
  Package,
  PackageCheck,
  Plus,
  Search,
  Tag,
  Trash2,
  X,
} from "lucide-react";

import { PRODUCT_CATEGORIES } from "../../constants/productCategories";
import { DEFAULT_PRODUCTS } from "../../data/defaultProducts";

import {
  createProduct,
  deleteProduct,
  getProducts,
  updateProduct,
} from "../../services/productService";

import "./Products.css";

const initialForm = {
  name: "",
  price: "",
  category: "",
  stock: "",
  is_active: true,
};

function Products() {
  const { t } = useTranslation();

  const [products, setProducts] = useState([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const [formData, setFormData] = useState(initialForm);
  const [editingProduct, setEditingProduct] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [seedingProducts, setSeedingProducts] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (!message && !error) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setMessage("");
      setError("");
    }, 4000);

    return () => window.clearTimeout(timeoutId);
  }, [message, error]);

  async function loadProducts() {
    try {
      setLoading(true);
      setError("");

      const data = await getProducts();

      const productsList = Array.isArray(data) ? data : data?.products || [];

      setProducts(productsList);
    } catch (err) {
      console.error("Error loading products:", err);

      setError(err.message || t("products.loadError"));
    } finally {
      setLoading(false);
    }
  }

  function getProductId(product) {
    return product.id || product._id;
  }

  function resetMessages() {
    setError("");
    setMessage("");
  }

  function openCreateModal() {
    setEditingProduct(null);
    setFormData(initialForm);
    resetMessages();
    setModalOpen(true);
  }

  function openEditModal(product) {
    setEditingProduct(product);

    setFormData({
      name: product.name || "",
      price: product.price ?? "",
      category: product.category || "",
      stock: product.stock ?? "",
      is_active: product.is_active !== false,
    });

    resetMessages();
    setModalOpen(true);
  }

  function closeModal() {
    if (submitting) {
      return;
    }

    setModalOpen(false);
    setEditingProduct(null);
    setFormData(initialForm);
  }

  function handleChange(event) {
    const { name, value, type, checked } = event.target;

    setFormData((currentData) => ({
      ...currentData,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function validateForm() {
    const price = Number(formData.price);
    const stock = Number(formData.stock);

    if (!formData.name.trim()) {
      return t("products.validation.nameRequired");
    }

    if (!formData.category) {
      return t("products.validation.categoryRequired");
    }

    if (!PRODUCT_CATEGORIES.includes(formData.category)) {
      return t("products.validation.invalidCategory");
    }

    if (Number.isNaN(price) || price <= 0) {
      return t("products.validation.invalidPrice");
    }

    if (formData.stock === "" || Number.isNaN(stock) || stock < 0) {
      return t("products.validation.invalidStock");
    }

    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();

    resetMessages();

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    const productData = {
      name: formData.name.trim(),
      price: Number(formData.price),
      category: formData.category,
      stock: Number(formData.stock),
      is_active: formData.is_active,
    };

    try {
      setSubmitting(true);

      if (editingProduct) {
        const productId = getProductId(editingProduct);

        const updatedProduct = await updateProduct(productId, productData);

        setProducts((currentProducts) =>
          currentProducts.map((product) =>
            getProductId(product) === productId ? updatedProduct : product,
          ),
        );

        setMessage(
          t("products.messages.updated", {
            name: updatedProduct.name,
          }),
        );
      } else {
        const createdProduct = await createProduct(productData);

        setProducts((currentProducts) => [createdProduct, ...currentProducts]);

        setMessage(
          t("products.messages.created", {
            name: createdProduct.name,
          }),
        );
      }

      setModalOpen(false);
      setEditingProduct(null);
      setFormData(initialForm);
    } catch (err) {
      console.error("Error saving product:", err);

      const apiMessage = err.response?.data?.detail;

      setError(
        typeof apiMessage === "string"
          ? apiMessage
          : err.message || t("products.messages.saveError"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(product) {
    const productId = getProductId(product);

    const confirmed = window.confirm(
      t("products.messages.deleteConfirm", {
        name: product.name,
      }),
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(productId);
      resetMessages();

      await deleteProduct(productId);

      setProducts((currentProducts) =>
        currentProducts.filter(
          (currentProduct) => getProductId(currentProduct) !== productId,
        ),
      );

      setMessage(
        t("products.messages.deleted", {
          name: product.name,
        }),
      );
    } catch (err) {
      console.error("Error deleting product:", err);

      const apiMessage = err.response?.data?.detail;

      setError(
        typeof apiMessage === "string"
          ? apiMessage
          : err.message || t("products.messages.deleteError"),
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSeedProducts() {
    const confirmed = window.confirm(
      t("products.messages.seedConfirm", {
        count: DEFAULT_PRODUCTS.length,
      }),
    );

    if (!confirmed) {
      return;
    }

    try {
      setSeedingProducts(true);
      resetMessages();

      const existingKeys = new Set(
        products.map(
          (product) =>
            `${String(product.name || "")
              .trim()
              .toLowerCase()}|${String(product.category || "")
              .trim()
              .toLowerCase()}`,
        ),
      );

      const productsToCreate = DEFAULT_PRODUCTS.filter((product) => {
        const key = `${product.name.trim().toLowerCase()}|${product.category
          .trim()
          .toLowerCase()}`;

        return !existingKeys.has(key);
      });

      if (productsToCreate.length === 0) {
        setMessage(t("products.messages.allExist"));
        return;
      }

      const results = await Promise.allSettled(
        productsToCreate.map((product) => createProduct(product)),
      );

      const createdCount = results.filter(
        (result) => result.status === "fulfilled",
      ).length;

      const failedResults = results.filter(
        (result) => result.status === "rejected",
      );

      failedResults.forEach((result) => {
        console.error("Product seed error:", result.reason);
      });

      await loadProducts();

      if (failedResults.length === 0) {
        setMessage(
          t("products.messages.seedSuccess", {
            count: createdCount,
          }),
        );
      } else {
        const firstError = failedResults[0]?.reason;
        const apiDetail = firstError?.response?.data?.detail;

        setError(
          typeof apiDetail === "string"
            ? t("products.messages.seedPartialErrorWithDetail", {
                created: createdCount,
                error: apiDetail,
              })
            : t("products.messages.seedPartialError", {
                created: createdCount,
                failed: failedResults.length,
              }),
        );
      }
    } catch (err) {
      console.error("Seed products error:", err);

      const detail = err.response?.data?.detail;

      setError(
        typeof detail === "string"
          ? detail
          : err.message || t("products.messages.seedError"),
      );
    } finally {
      setSeedingProducts(false);
    }
  }

  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return products.filter((product) => {
      const productName = String(product.name || "").toLowerCase();

      const productCategory = String(product.category || "").toLowerCase();

      const matchesSearch =
        productName.includes(normalizedSearch) ||
        productCategory.includes(normalizedSearch);

      const matchesCategory =
        activeCategory === "All" || product.category === activeCategory;

      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, activeCategory]);

  const statistics = useMemo(() => {
    const activeProducts = products.filter(
      (product) => product.is_active !== false,
    ).length;

    const uniqueCategories = new Set(
      products.map((product) => product.category).filter(Boolean),
    ).size;

    const averagePrice =
      products.length > 0
        ? products.reduce(
            (total, product) => total + Number(product.price || 0),
            0,
          ) / products.length
        : 0;

    return {
      total: products.length,
      active: activeProducts,
      categories: uniqueCategories,
      averagePrice,
    };
  }, [products]);

  function getCategoryIcon(category) {
    if (category === "Coffee") {
      return <Coffee size={24} />;
    }

    if (category === "Food") {
      return <PackageCheck size={24} />;
    }

    if (category === "Desserts") {
      return <Tag size={24} />;
    }

    return <Package size={24} />;
  }

  return (
    <section className="products-page">
      <header className="products-header">
        <div>
          <p className="products-eyebrow">{t("products.eyebrow")}</p>

          <h1>{t("products.title")}</h1>

          <p className="products-description">{t("products.description")}</p>
        </div>

        <div className="products-header-actions">
          <button
            type="button"
            className="products-seed-button"
            onClick={handleSeedProducts}
            disabled={seedingProducts}
          >
            {seedingProducts ? (
              <LoaderCircle size={18} className="products-spinner" />
            ) : (
              <PackageCheck size={18} />
            )}

            {seedingProducts
              ? t("products.addingMenu")
              : t("products.addDefaultMenu")}
          </button>

          <button
            type="button"
            className="products-add-button"
            onClick={openCreateModal}
            disabled={seedingProducts}
          >
            <Plus size={19} />
            {t("products.addProduct")}
          </button>
        </div>
      </header>

      {message && (
        <div className="products-message products-message-success">
          <CheckCircle2 size={19} />
          <span>{message}</span>
        </div>
      )}

      {error && !modalOpen && (
        <div className="products-message products-message-error">
          <AlertCircle size={19} />
          <span>{error}</span>
        </div>
      )}

      <div className="products-stats-grid">
        <article className="products-stat-card">
          <div className="products-stat-icon">
            <Boxes size={22} />
          </div>

          <div>
            <span>{t("products.totalProducts")}</span>
            <strong>{statistics.total}</strong>
          </div>
        </article>

        <article className="products-stat-card">
          <div className="products-stat-icon">
            <Tag size={22} />
          </div>

          <div>
            <span>{t("products.categories")}</span>
            <strong>{statistics.categories}</strong>
          </div>
        </article>

        <article className="products-stat-card">
          <div className="products-stat-icon">
            <PackageCheck size={22} />
          </div>

          <div>
            <span>{t("products.activeProducts")}</span>
            <strong>{statistics.active}</strong>
          </div>
        </article>

        <article className="products-stat-card">
          <div className="products-stat-icon">
            <Coffee size={22} />
          </div>

          <div>
            <span>{t("products.averagePrice")}</span>

            <strong>€{statistics.averagePrice.toFixed(2)}</strong>
          </div>
        </article>
      </div>

      <div className="products-toolbar">
        <div className="products-search">
          <Search size={19} />

          <input
            type="text"
            value={searchTerm}
            placeholder={t("products.searchPlaceholder")}
            onChange={(event) => setSearchTerm(event.target.value)}
          />

          {searchTerm && (
            <button
              type="button"
              aria-label={t("products.clearSearch")}
              onClick={() => setSearchTerm("")}
            >
              <X size={17} />
            </button>
          )}
        </div>

        <div className="products-category-filters">
          {["All", ...PRODUCT_CATEGORIES].map((category) => (
            <button
              key={category}
              type="button"
              className={
                activeCategory === category
                  ? "products-filter-button products-filter-button-active"
                  : "products-filter-button"
              }
              onClick={() => setActiveCategory(category)}
            >
              {category === "All"
                ? t("products.categoriesFilter.all")
                : t(`products.categoriesFilter.${category}`, { defaultValue: category })}
            </button>
          ))}
        </div>
      </div>

      <div className="products-list-header">
        <div>
          <h2>{t("products.productList")}</h2>

          <p>
            {t("products.showingProducts", {
              filtered: filteredProducts.length,
              total: products.length,
            })}
          </p>
        </div>

        <button
          type="button"
          className="products-refresh-button"
          onClick={loadProducts}
          disabled={loading}
        >
          {loading && <LoaderCircle size={17} className="products-spinner" />}

          {loading ? t("products.loadingShort") : t("products.refresh")}
        </button>
      </div>

      {loading ? (
        <div className="products-state-card">
          <LoaderCircle size={34} className="products-spinner" />

          <h3>{t("products.loadingProducts")}</h3>

          <p>{t("products.loadingDescription")}</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="products-state-card">
          <div className="products-empty-icon">
            <Package size={34} />
          </div>

          <h3>
            {products.length === 0
              ? t("products.noProductsYet")
              : t("products.noMatchingProducts")}
          </h3>

          <p>
            {products.length === 0
              ? t("products.noProductsDescription")
              : t("products.noMatchingDescription")}
          </p>

          {products.length === 0 && (
            <button
              type="button"
              className="products-add-button"
              onClick={openCreateModal}
            >
              <Plus size={18} />
              {t("products.addFirstProduct")}
            </button>
          )}
        </div>
      ) : (
        <div className="products-grid">
          {filteredProducts.map((product) => {
            const productId = getProductId(product);
            const stock = Number(product.stock || 0);
            const isDeleting = deletingId === productId;

            return (
              <article key={productId} className="product-card">
                <div className="product-card-top">
                  <div className="product-category-icon">
                    {getCategoryIcon(product.category)}
                  </div>

                  <span
                    className={
                      product.is_active !== false
                        ? "product-status product-status-active"
                        : "product-status product-status-inactive"
                    }
                  >
                    <span />
                    {product.is_active !== false
                      ? t("products.active")
                      : t("products.inactive")}
                  </span>
                </div>

                <div className="product-card-content">
                  <span className="product-category-label">
                    {t(`products.categoriesFilter.${product.category}`, { defaultValue: product.category })}
                  </span>

                  <h3>{product.name}</h3>

                  <p className="product-price">
                    €{Number(product.price || 0).toFixed(2)}
                  </p>
                </div>

                <div className="product-stock-row">
                  <div>
                    <span>{t("products.stock")}</span>
                    <strong>{stock}</strong>
                  </div>

                  <span
                    className={
                      stock === 0
                        ? "product-stock-badge product-stock-empty"
                        : stock <= 10
                          ? "product-stock-badge product-stock-low"
                          : "product-stock-badge product-stock-good"
                    }
                  >
                    {stock === 0
                      ? t("products.outOfStock")
                      : stock <= 10
                        ? t("products.lowStock")
                        : t("products.inStock")}
                  </span>
                </div>

                <div className="product-card-actions">
                  <button
                    type="button"
                    className="product-edit-button"
                    disabled={isDeleting}
                    onClick={() => openEditModal(product)}
                  >
                    <Edit3 size={17} />
                    {t("products.edit")}
                  </button>

                  <button
                    type="button"
                    className="product-delete-button"
                    disabled={isDeleting}
                    onClick={() => handleDelete(product)}
                  >
                    {isDeleting ? (
                      <LoaderCircle size={17} className="products-spinner" />
                    ) : (
                      <Trash2 size={17} />
                    )}

                    {isDeleting ? t("products.deleting") : t("products.delete")}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <div
          className="product-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <div className="product-modal">
            <header className="product-modal-header">
              <div>
                <p className="products-eyebrow">
                  {editingProduct
                    ? t("products.modal.updateEyebrow")
                    : t("products.modal.newEyebrow")}
                </p>

                <h2>
                  {editingProduct
                    ? t("products.modal.editTitle")
                    : t("products.modal.addTitle")}
                </h2>

                <p>
                  {editingProduct
                    ? t("products.modal.editDescription")
                    : t("products.modal.addDescription")}
                </p>
              </div>

              <button
                type="button"
                className="product-modal-close"
                aria-label={t("products.modal.close")}
                disabled={submitting}
                onClick={closeModal}
              >
                <X size={21} />
              </button>
            </header>

            <form className="product-form" onSubmit={handleSubmit}>
              {error && (
                <div className="products-message products-message-error">
                  <AlertCircle size={18} />
                  <span>{error}</span>
                </div>
              )}

              <div className="product-form-group product-form-full">
                <label htmlFor="product-name">
                  {t("products.modal.productName")}
                </label>

                <input
                  id="product-name"
                  name="name"
                  type="text"
                  value={formData.name}
                  placeholder={t("products.modal.namePlaceholder")}
                  autoFocus
                  onChange={handleChange}
                />
              </div>

              <div className="product-form-row">
                <div className="product-form-group">
                  <label htmlFor="product-price">
                    {t("products.modal.price")}
                  </label>

                  <div className="product-price-input">
                    <span>€</span>

                    <input
                      id="product-price"
                      name="price"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={formData.price}
                      placeholder="2.50"
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="product-form-group">
                  <label htmlFor="product-stock">
                    {t("products.modal.stock")}
                  </label>

                  <input
                    id="product-stock"
                    name="stock"
                    type="number"
                    min="0"
                    step="1"
                    value={formData.stock}
                    placeholder="50"
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="product-form-group product-form-full">
                <label htmlFor="product-category">
                  {t("products.modal.category")}
                </label>

                <select
                  id="product-category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                >
                  <option value="">{t("products.modal.selectCategory")}</option>

                  {PRODUCT_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {t(`products.categoriesFilter.${category}`, { defaultValue: category })}
                    </option>
                  ))}
                </select>
              </div>

              <label className="product-active-control">
                <div>
                  <strong>{t("products.modal.activeProduct")}</strong>

                  <span>{t("products.modal.activeDescription")}</span>
                </div>

                <input
                  name="is_active"
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={handleChange}
                />

                <span className="product-toggle" />
              </label>

              <div className="product-modal-actions">
                <button
                  type="button"
                  className="product-cancel-button"
                  disabled={submitting}
                  onClick={closeModal}
                >
                  {t("products.modal.cancel")}
                </button>

                <button
                  type="submit"
                  className="products-add-button"
                  disabled={submitting}
                >
                  {submitting ? (
                    <LoaderCircle size={18} className="products-spinner" />
                  ) : editingProduct ? (
                    <Edit3 size={18} />
                  ) : (
                    <Plus size={18} />
                  )}

                  {submitting
                    ? t("products.modal.saving")
                    : editingProduct
                      ? t("products.modal.saveChanges")
                      : t("products.modal.addProduct")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

export default Products;
