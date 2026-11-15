package main

import (
	"context"
	"database/sql"
	"log"
	"net"
	"net/url"
	"os"
	"os/signal"
	"syscall"
	"time"

	"billing-service/consumer"
	"github.com/go-sql-driver/mysql"
)

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	if os.Getenv("BILLING_DB_USER") == "" || os.Getenv("BILLING_DB_PASS") == "" || os.Getenv("BILLING_DB_NAME") == "" {
		log.Fatal("BILLING_DB_USER, BILLING_DB_PASS and BILLING_DB_NAME are required")
	}
	cfg := mysql.NewConfig()
	cfg.User, cfg.Passwd, cfg.DBName = os.Getenv("BILLING_DB_USER"), os.Getenv("BILLING_DB_PASS"), os.Getenv("BILLING_DB_NAME")
	cfg.Net, cfg.Addr = "tcp", net.JoinHostPort(env("BILLING_DB_HOST", "127.0.0.1"), env("BILLING_DB_PORT", "3307"))
	cfg.ParseTime = true
	cfg.Timeout, cfg.ReadTimeout, cfg.WriteTimeout = 5*time.Second, 5*time.Second, 5*time.Second
	db, err := sql.Open("mysql", cfg.FormatDSN())
	if err != nil {
		log.Fatal("billing database configuration is invalid")
	}
	defer db.Close()
	db.SetMaxOpenConns(5)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(3 * time.Minute)
	amqpURL := os.Getenv("BILLING_AMQP_URL")
	if amqpURL == "" {
		if os.Getenv("RABBITMQ_DEFAULT_USER") == "" || os.Getenv("RABBITMQ_DEFAULT_PASS") == "" {
			log.Fatal("BILLING_AMQP_URL or RabbitMQ credentials are required")
		}
		// Escape vhost as a single URI segment, including a leading slash if set.
		vhost := env("RABBITMQ_DEFAULT_VHOST", "medcore_vhost")
		u := url.URL{Scheme: "amqp", User: url.UserPassword(os.Getenv("RABBITMQ_DEFAULT_USER"), os.Getenv("RABBITMQ_DEFAULT_PASS")),
			Host: net.JoinHostPort(env("RABBITMQ_HOST", "127.0.0.1"), env("RABBITMQ_PORT", "5672")), Path: "/" + vhost, RawPath: "/" + url.PathEscape(vhost)}
		amqpURL = u.String()
	}
	service := &consumer.Service{DB: db}
	for ctx.Err() == nil {
		if err := consumer.Consume(ctx, amqpURL, service); err != nil && ctx.Err() == nil {
			log.Printf("%v; reconnecting in 5s", err)
		}
		select {
		case <-ctx.Done():
		case <-time.After(5 * time.Second):
		}
	}
	log.Print("billing worker stopped")
}
