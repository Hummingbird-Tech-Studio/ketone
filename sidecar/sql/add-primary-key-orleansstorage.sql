-- Add primary key to OrleansStorage table
ALTER TABLE OrleansStorage 
ADD CONSTRAINT pk_orleansstorage 
PRIMARY KEY (GrainIdHash, GrainTypeHash, GrainIdN0, GrainIdN1, ServiceId);
