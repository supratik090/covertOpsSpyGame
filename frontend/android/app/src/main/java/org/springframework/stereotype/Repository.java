package org.springframework.stereotype;

import java.lang.annotation.*;

@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.TYPE})
public @interface Repository {
    String value() default "";
}
