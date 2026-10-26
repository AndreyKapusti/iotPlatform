package auth

import (
	"errors"
	"fmt"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

func UsernameFromToken(secret, raw string) (string, error) {
	if secret == "" || strings.TrimSpace(raw) == "" {
		return "", errors.New("missing token")
	}
	parsed, err := jwt.Parse(raw, func(token *jwt.Token) (interface{}, error) {
		if token.Method != jwt.SigningMethodHS256 {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return []byte(secret), nil
	})
	if err != nil || parsed == nil || !parsed.Valid {
		return "", errors.New("invalid token")
	}
	claims, ok := parsed.Claims.(jwt.MapClaims)
	if !ok {
		return "", errors.New("invalid claims")
	}
	subject, _ := claims["sub"].(string)
	if subject == "" {
		return "", errors.New("missing sub")
	}
	return subject, nil
}
