import time
from urllib.parse import quote_plus
from flask import Flask, request, jsonify
from flask_cors import CORS
from sqlalchemy import text
from database import db, Product, Inventory, Order, OrderItem

app = Flask(__name__)
CORS(app)

pwd = quote_plus("Vasantha@Murthy335")
app.config['SQLALCHEMY_DATABASE_URI'] = f'mysql+pymysql://root:{pwd}@localhost:3306/smart_fulfilment'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

@app.route('/api/inventory', methods=['GET'])
def get_inventory():
    """Live inventory endpoint returning 250+ categorized products"""
    results = db.session.execute(text("""
        SELECT p.id, p.name, p.price, COALESCE(p.category, 'General') as category, i.stock_quantity
        FROM products p
        JOIN inventory i ON p.id = i.product_id
        ORDER BY p.category ASC, p.name ASC, p.price ASC
    """)).fetchall()

    data = []
    for r in results:
        qty = r.stock_quantity
        if qty <= 0:
            status = "OUT_OF_STOCK"
        elif qty <= 2:
            status = "CRITICAL_LOW"
        elif qty <= 5:
            status = "WARNING_REFILL"
        else:
            status = "HEALTHY"

        data.append({
            "product_id": r.id,
            "name": r.name,
            "category": r.category,
            "price": float(r.price),
            "stock_quantity": qty,
            "status": status
        })
    return jsonify(data), 200

@app.route('/api/inventory/new-product', methods=['POST'])
def add_new_product():
    """
    If Name AND Price match -> Increment existing stock additively.
    If Price differs -> Add as a distinct new batch card under the category.
    """
    data = request.get_json() or {}
    name = str(data.get('name', '')).strip()
    category = str(data.get('category', 'General')).strip()
    try:
        price = float(data.get('price', 0))
        initial_stock = int(data.get('initial_stock', 0))
    except (ValueError, TypeError):
        return jsonify({"error": "Price and Stock must be valid numbers."}), 400

    if not name or price <= 0 or initial_stock < 0:
        return jsonify({"error": "Please provide valid Product Name, Price, and Stock."}), 400

    try:
        exact_match = db.session.query(Product).filter(
            Product.name.ilike(name),
            Product.price == price
        ).first()

        if exact_match:
            inv = db.session.query(Inventory).filter(Inventory.product_id == exact_match.id).with_for_update().first()
            if inv:
                inv.stock_quantity += initial_stock
                if category and category != 'General':
                    exact_match.category = category
                db.session.commit()
                return jsonify({
                    "message": f"Added {initial_stock} units to existing '{name}' (₹{price:.2f}). Total stock: {inv.stock_quantity}.",
                    "product_id": exact_match.id
                }), 200

        auto_sku = f"SKU-{int(time.time() * 1000)}"
        new_prod = Product(sku=auto_sku, name=name, price=price)
        new_prod.category = category if category else 'General'
        db.session.add(new_prod)
        db.session.flush()

        new_inv = Inventory(product_id=new_prod.id, stock_quantity=initial_stock, reserved_quantity=0)
        db.session.add(new_inv)

        db.session.commit()
        return jsonify({
            "message": f"Registered '{name}' at ₹{price:.2f} under '{new_prod.category}' with {initial_stock} units!",
            "product_id": new_prod.id
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to save product: {str(e)}"}), 500

@app.route('/api/inventory/<int:product_id>', methods=['DELETE'])
def delete_product(product_id):
    """Deletes an item permanently from inventory"""
    try:
        inv = db.session.query(Inventory).filter_by(product_id=product_id).first()
        if inv:
            db.session.delete(inv)

        db.session.execute(text(f"DELETE FROM order_items WHERE product_id = {product_id}"))

        prod = db.session.get(Product, product_id)
        if prod:
            db.session.delete(prod)

        db.session.commit()
        return jsonify({"message": "Item deleted."}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/inventory/add', methods=['POST'])
def add_inventory():
    """Additive Restock: adds quantity to an existing product"""
    data = request.get_json() or {}
    product_id = data.get('product_id')
    try:
        add_qty = int(data.get('quantity', 0))
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid quantity"}), 400

    if not product_id or add_qty <= 0:
        return jsonify({"error": "Quantity must be greater than zero"}), 400

    try:
        inv = db.session.query(Inventory).filter(Inventory.product_id == product_id).with_for_update().first()
        if not inv:
            return jsonify({"error": "Product not found"}), 404

        inv.stock_quantity += add_qty
        db.session.commit()
        return jsonify({"message": f"Added {add_qty} units! Total stock is now {inv.stock_quantity}"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/orders/checkout', methods=['POST'])
def checkout_order():
    """Immediately deducts stock upon customer purchase"""
    payload = request.get_json() or {}
    items = payload.get('items', [])

    if not items:
        return jsonify({"error": "Cart is empty"}), 400

    try:
        total_amount = 0.0
        line_items = []

        for item in items:
            p_id = int(item['product_id'])
            qty = int(item['quantity'])

            inv = db.session.query(Inventory).filter(Inventory.product_id == p_id).with_for_update().first()
            if not inv:
                raise ValueError(f"Product #{p_id} not found.")

            if inv.stock_quantity <= 0:
                raise ValueError("Item is SOLD OUT.")

            if inv.stock_quantity < qty:
                raise ValueError(f"Only {inv.stock_quantity} units available. Cannot bill {qty}.")

            inv.stock_quantity -= qty

            prod = db.session.get(Product, p_id)
            price = float(prod.price)
            total_amount += (price * qty)
            line_items.append((p_id, qty, price))

        order = Order(customer_id=1, status='FULFILLED', total_amount=total_amount)
        db.session.add(order)
        db.session.flush()

        for p_id, qty, price in line_items:
            db.session.add(OrderItem(order_id=order.id, product_id=p_id, quantity=qty, unit_price=price))

        db.session.commit()
        return jsonify({
            "message": f"Order #{order.id} placed! Total: ₹{total_amount:.2f}",
            "order_id": order.id,
            "total_amount": round(total_amount, 2)
        }), 201

    except ValueError as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Error: {str(e)}"}), 500

@app.route('/api/orders', methods=['GET'])
def get_orders():
    orders = db.session.query(Order).order_by(Order.id.desc()).limit(20).all()
    out = []
    for o in orders:
        items = db.session.query(OrderItem, Product.name)\
            .join(Product, OrderItem.product_id == Product.id)\
            .filter(OrderItem.order_id == o.id).all()

        total_units = sum(itm.OrderItem.quantity for itm in items)

        out.append({
            "id": o.id,
            "total_amount": float(o.total_amount),
            "units_sold": total_units,
            "items_summary": [f"{itm.name} (x{itm.OrderItem.quantity})" for itm in items]
        })
    return jsonify(out), 200

if __name__ == '__main__':
    app.run(debug=True, port=5000)