package org.springframework.data.mongodb.repository;

import java.util.List;
import java.util.Optional;

public interface MongoRepository<T, ID> {
    <S extends T> S save(S entity);
    Optional<T> findById(ID id);
    List<T> findAll();
    void deleteById(ID id);
    void delete(T entity);
    boolean existsById(ID id);
}
