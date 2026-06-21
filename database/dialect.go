package database

import "fmt"

// JSONClientsFromInbound returns the FROM clause for iterating settings.clients in SQLite.
func JSONClientsFromInbound() string {
	return "FROM inbounds, JSON_EACH(JSON_EXTRACT(inbounds.settings, '$.clients')) AS client"
}

func JSONFieldText(expr, key string) string {
	return fmt.Sprintf("TRIM(JSON_EXTRACT(%s, '$.%s'), '\"')", expr, key)
}

func GreatestExpr(a, b string) string {
	return fmt.Sprintf("MAX(%s, %s)", a, b)
}
