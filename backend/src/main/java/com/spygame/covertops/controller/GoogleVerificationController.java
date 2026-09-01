package com.spygame.covertops.controller;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@CrossOrigin(origins = "*")
public class GoogleVerificationController {

    @GetMapping(value = "/google4d387b5b1d7b3517.html", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> getGoogleVerification() {
        return ResponseEntity.ok("google-site-verification: google4d387b5b1d7b3517.html");
    }
}
