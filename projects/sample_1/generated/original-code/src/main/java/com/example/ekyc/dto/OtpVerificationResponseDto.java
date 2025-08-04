package com.example.ekyc.dto;

import java.time.LocalDateTime;

public class OtpVerificationResponseDto {

    private String status;
    private KycDataDto kycData;
    private LocalDateTime timestamp;
    private String message;
    private String referenceNumber;

    public OtpVerificationResponseDto() {}

    public OtpVerificationResponseDto(String status, KycDataDto kycData, LocalDateTime timestamp, 
                                    String message, String referenceNumber) {
        this.status = status;
        this.kycData = kycData;
        this.timestamp = timestamp;
        this.message = message;
        this.referenceNumber = referenceNumber;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public KycDataDto getKycData() {
        return kycData;
    }

    public void setKycData(KycDataDto kycData) {
        this.kycData = kycData;
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

    public String getReferenceNumber() {
        return referenceNumber;
    }

    public void setReferenceNumber(String referenceNumber) {
        this.referenceNumber = referenceNumber;
    }
}