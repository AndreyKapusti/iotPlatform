package mqtt

import "testing"

func TestBrokerOptionsUseIngestUser(t *testing.T) {
	opts := brokerOptions("tcp://mosquitto:1883", "ingest", "secret")
	if opts.Username != "ingest" {
		t.Fatalf("username %q", opts.Username)
	}
	if opts.Password != "secret" {
		t.Fatalf("password was not set on the client options")
	}
}

func TestBrokerOptionsStayEmptyWithoutCredentials(t *testing.T) {
	opts := brokerOptions("tcp://localhost:1883", "", "")
	if opts.Username != "" || opts.Password != "" {
		t.Fatalf("username %q password %q", opts.Username, opts.Password)
	}
}
