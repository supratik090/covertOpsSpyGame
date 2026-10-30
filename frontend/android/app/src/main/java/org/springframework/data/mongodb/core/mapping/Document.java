package org.springframework.data.mongodb.core.mapping;

import java.lang.annotation.*;

@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.TYPE})
public @interface Document {
    String collection() default "";
    String value() default "";
}
