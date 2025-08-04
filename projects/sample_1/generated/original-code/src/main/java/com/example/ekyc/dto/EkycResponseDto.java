package com.example.ekyc.dto;

import java.time.LocalDateTime;

public class EkycResponseDto {

    private String status;
    private String referenceNumber;
    private LocalDateTime timestamp;
    private String message;
    private String sessionId;

    public EkycResponseDto() {}

    public EkycResponseDto(String status, String referenceNumber, LocalDateTime timestamp, 
                          String message, String sessionId) {
        this.status = status;
        this.referenceNumber = referenceNumber;
        this.timestamp = timestamp;
        this.message = message;
        this.sessionId = sessionId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getReferenceNumber() {
        return referenceNumber;
    }

    public void setReferenceNumber(String referenceNumber) {
        this.referenceNumber = referenceNumber;
    }

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }
}