package com.pub_game_be.reliability;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Conversione JSON verso le collezioni Java usate nelle risposte REST.
 *
 * <p>Non usa {@code JSONObject.toMap()} né {@code JSONArray.toList()}: quei
 * metodi non esistono in tutte le versioni di org.json presenti sul classpath,
 * e un {@code NoSuchMethodError} a runtime è esattamente il tipo di errore che
 * questa milestone non deve introdurre.</p>
 */
public final class JsonSupport {

    private JsonSupport() {
    }

    public static Map<String, Object> toMap(JSONObject object) {
        Map<String, Object> out = new LinkedHashMap<>();
        if (object == null) {
            return out;
        }
        for (String key : object.keySet()) {
            out.put(key, normalize(object.opt(key)));
        }
        return out;
    }

    public static List<Object> toList(JSONArray array) {
        List<Object> out = new ArrayList<>();
        if (array == null) {
            return out;
        }
        for (int index = 0; index < array.length(); index++) {
            out.add(normalize(array.opt(index)));
        }
        return out;
    }

    private static Object normalize(Object value) {
        if (value instanceof JSONObject nested) {
            return toMap(nested);
        }
        if (value instanceof JSONArray nested) {
            return toList(nested);
        }
        if (value == null || value == JSONObject.NULL) {
            return null;
        }
        return value;
    }
}
