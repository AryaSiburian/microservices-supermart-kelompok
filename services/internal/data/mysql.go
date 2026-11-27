package data

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net"
	"os"
	"time"

	"github.com/go-sql-driver/mysql"
)

func Open() (*sql.DB, error) {
	cfg := mysql.NewConfig()
	cfg.User, cfg.Passwd, cfg.DBName = os.Getenv("MYSQL_USER"), os.Getenv("MYSQL_PASSWORD"), os.Getenv("MYSQL_DATABASE")
	if cfg.User == "" || cfg.Passwd == "" || cfg.DBName == "" {
		return nil, fmt.Errorf("MYSQL_USER, MYSQL_PASSWORD and MYSQL_DATABASE are required")
	}
	host, port := os.Getenv("MYSQL_HOST"), os.Getenv("MYSQL_PORT")
	if host == "" {
		host = "mysql"
	}
	if port == "" {
		port = "3306"
	}
	cfg.Net, cfg.Addr, cfg.ParseTime = "tcp", net.JoinHostPort(host, port), true
	cfg.Timeout, cfg.ReadTimeout, cfg.WriteTimeout = 3*time.Second, 3*time.Second, 3*time.Second
	db, err := sql.Open("mysql", cfg.FormatDSN())
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(5)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(3 * time.Minute)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err = db.PingContext(ctx); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}

type Product struct {
	ID          string      `json:"id"`
	SKU         string      `json:"sku"`
	Title       string      `json:"title"`
	Description string      `json:"description"`
	BasePrice   json.Number `json:"base_price"`
}

type OrderProduct struct {
	Product
	Quantity  int         `json:"quantity"`
	UnitPrice json.Number `json:"unit_price"`
}

type Item struct {
	ProductID string      `json:"product_id"`
	Quantity  int         `json:"quantity"`
	UnitPrice json.Number `json:"unit_price"`
	Subtotal  json.Number `json:"subtotal"`
}

type Order struct {
	ID               string      `json:"id"`
	OrderNumber      string      `json:"order_number"`
	Status           string      `json:"status"`
	TotalGrossAmount json.Number `json:"total_gross_amount"`
	DiscountAmount   json.Number `json:"discount_amount"`
	TaxAmount        json.Number `json:"tax_amount"`
	ShippingFee      json.Number `json:"shipping_fee"`
	TotalNetAmount   json.Number `json:"total_net_amount"`
	Items            []Item      `json:"items"`
}

func ProductByID(ctx context.Context, db *sql.DB, id string) (Product, error) {
	var p Product
	var price string
	err := db.QueryRowContext(ctx, `SELECT id,sku,title,COALESCE(description,''),base_price
		FROM products WHERE id=? AND is_published=1`, id).Scan(&p.ID, &p.SKU, &p.Title, &p.Description, &price)
	p.BasePrice = json.Number(price)
	return p, err
}

// This read adapter uses the existing shared legacy schema. It follows the
// actual order_items relationship, never assuming order_id equals product_id.
func ProductsByOrder(ctx context.Context, db *sql.DB, id string) ([]OrderProduct, error) {
	var exists int
	if err := db.QueryRowContext(ctx, "SELECT 1 FROM orders WHERE id=?", id).Scan(&exists); err != nil {
		return nil, err
	}
	rows, err := db.QueryContext(ctx, `SELECT p.id,p.sku,p.title,COALESCE(p.description,''),
		p.base_price,oi.quantity,oi.unit_price FROM order_items oi
		JOIN products p ON p.id=oi.product_id WHERE oi.order_id=? ORDER BY oi.id`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	products := make([]OrderProduct, 0)
	for rows.Next() {
		var p OrderProduct
		var price, unit string
		if err = rows.Scan(&p.ID, &p.SKU, &p.Title, &p.Description, &price, &p.Quantity, &unit); err != nil {
			return nil, err
		}
		p.BasePrice, p.UnitPrice = json.Number(price), json.Number(unit)
		products = append(products, p)
	}
	return products, rows.Err()
}

func OrderByID(ctx context.Context, db *sql.DB, id string) (Order, error) {
	var o Order
	var gross, discount, tax, shipping, total string
	err := db.QueryRowContext(ctx, `SELECT o.id,o.order_number,s.status_code,o.total_gross_amount,
		o.discount_amount,o.tax_amount,o.shipping_fee,o.total_net_amount
		FROM orders o JOIN order_statuses s ON s.id=o.order_status_id WHERE o.id=?`, id).
		Scan(&o.ID, &o.OrderNumber, &o.Status, &gross, &discount, &tax, &shipping, &total)
	if err != nil {
		return o, err
	}
	o.TotalGrossAmount, o.DiscountAmount, o.TaxAmount, o.ShippingFee, o.TotalNetAmount =
		json.Number(gross), json.Number(discount), json.Number(tax), json.Number(shipping), json.Number(total)
	rows, err := db.QueryContext(ctx, `SELECT product_id,quantity,unit_price,subtotal
		FROM order_items WHERE order_id=? ORDER BY id`, id)
	if err != nil {
		return o, err
	}
	defer rows.Close()
	o.Items = make([]Item, 0)
	for rows.Next() {
		var item Item
		var unit, subtotal string
		if err = rows.Scan(&item.ProductID, &item.Quantity, &unit, &subtotal); err != nil {
			return o, err
		}
		item.UnitPrice, item.Subtotal = json.Number(unit), json.Number(subtotal)
		o.Items = append(o.Items, item)
	}
	return o, rows.Err()
}
