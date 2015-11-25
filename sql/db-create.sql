CREATE SEQUENCE public.link_index_seq
  INCREMENT 1
  MINVALUE 1
  MAXVALUE 9223372036854775807
  START 1
  CACHE 1;
ALTER TABLE public.link_index_seq
  OWNER TO ckaner;

CREATE SEQUENCE public.package_group_id_seq
  INCREMENT 1
  MINVALUE 1
  MAXVALUE 9223372036854775807
  START 1
  CACHE 1;

ALTER TABLE public.package_group_id_seq
  OWNER TO ckaner;

CREATE SEQUENCE public.resource_queryable_id_seq
  INCREMENT 1
  MINVALUE 1
  MAXVALUE 9223372036854775807
  START 1
  CACHE 1;

ALTER TABLE public.resource_queryable_id_seq
  OWNER TO ckaner;

CREATE SEQUENCE public.resource_field_id_seq
  INCREMENT 1
  MINVALUE 1
  MAXVALUE 9223372036854775807
  START 1
  CACHE 1;

ALTER TABLE public.resource_field_id_seq
  OWNER TO ckaner;

CREATE TABLE public.link
(
  url character varying(30),
  configuration text NOT NULL,
  ip character varying(45),
  index bigint NOT NULL DEFAULT nextval('link_index_seq'::regclass),
  CONSTRAINT pk_link PRIMARY KEY (index)
)
WITH (
  OIDS=FALSE
);
ALTER TABLE public.link
  OWNER TO ckaner;

CREATE INDEX idx_url
  ON public.link
  USING btree
  (url COLLATE pg_catalog."default");

CREATE TABLE public.organization
(
  id text NOT NULL,
  name text,
  image text,
  title_en text,
  title_el text,
  caption_en text,
  caption_el text,
  description_en text,
  description_el text,
  CONSTRAINT pk_organization PRIMARY KEY (id)
)
WITH (
  OIDS=FALSE
);

ALTER TABLE public.organization
  OWNER TO ckaner;

CREATE TABLE public."group"
(
  id text NOT NULL,
  name text,
  image text,
  title_en text,
  title_el text,
  caption_en text,
  caption_el text,
  description_en text,
  description_el text,
  CONSTRAINT pk_group PRIMARY KEY (id)
)
WITH (
  OIDS=FALSE
);

ALTER TABLE public."group"
  OWNER TO ckaner;

CREATE TABLE public."package"
(
  id text NOT NULL,
  organization text,
  name text,
  title_en text,
  title_el text,
  notes_en text,
  notes_el text,
  the_geom geometry,
  CONSTRAINT pk_package PRIMARY KEY (id),
  CONSTRAINT fk_organization FOREIGN KEY (organization)
      REFERENCES public.organization (id) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT enforce_dims_the_geom CHECK (st_ndims(the_geom) = 2),
  CONSTRAINT enforce_srid_the_geom CHECK (st_srid(the_geom) = 4326)
)
WITH (
  OIDS=FALSE
);

ALTER TABLE public."package"
  OWNER TO ckaner;

CREATE TABLE public.package_group
(
  package_id text NOT NULL,
  group_id text NOT NULL,
  id bigint NOT NULL DEFAULT nextval('package_group_id_seq'::regclass),
  CONSTRAINT pk_package_group PRIMARY KEY (id),
  CONSTRAINT fk_group FOREIGN KEY (group_id)
      REFERENCES public."group" (id) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT fk_package FOREIGN KEY (package_id)
      REFERENCES public."package" (id) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE CASCADE
)
WITH (
  OIDS=FALSE
);

ALTER TABLE public.package_group
  OWNER TO ckaner;

CREATE TABLE public.resource_tree_node
(
  id bigint NOT NULL,
  parent bigint,
  caption_en text NOT NULL,
  caption_el text NOT NULL,
  visible boolean NOT NULL DEFAULT true,
  index int,
  CONSTRAINT pk_resource_tree_node PRIMARY KEY (id),
  CONSTRAINT fk_resource_tree_node FOREIGN KEY (parent)
      REFERENCES public.resource_tree_node (id) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE CASCADE
)
WITH (
  OIDS=FALSE
);
ALTER TABLE public.resource_tree_node
  OWNER TO ckaner;

CREATE TABLE public.resource
(
  id text NOT NULL,
  "package" text NOT NULL,
  name_en text NOT NULL,
  name_el text NOT NULL,
  description_en text,
  description_el text,
  format text,
  url text,
  wms_server text,
  wms_layer text,
  tree_node_id bigint,
  tree_node_index integer,
  tree_node_caption_el text NOT NULL,
  tree_node_caption_en text NOT NULL,
  visible boolean,
  CONSTRAINT pk_resource PRIMARY KEY (id),
  CONSTRAINT fk_package FOREIGN KEY ("package")
      REFERENCES public."package" (id) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT fk_resource_tree_node FOREIGN KEY (tree_node_id)
      REFERENCES public.resource_tree_node (id) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE SET NULL
)
WITH (
  OIDS=FALSE
);

ALTER TABLE public.resource
  OWNER TO ckaner;

CREATE TABLE public.resource_queryable
(
  id bigint NOT NULL DEFAULT nextval('resource_queryable_id_seq'::regclass),
  resource text NOT NULL,
  "table" text NOT NULL,
  srid integer,
  geometry_type text,
  geometry_column text,
  template text,
  active boolean,
  CONSTRAINT pk_resource_queryable PRIMARY KEY (id),
  CONSTRAINT fk_resource FOREIGN KEY (resource)
      REFERENCES public.resource (id) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE CASCADE
)
WITH (
  OIDS=FALSE
);

ALTER TABLE public.resource_queryable
  OWNER TO ckaner;

CREATE TABLE public.resource_field
(
  id bigint NOT NULL DEFAULT nextval('resource_field_id_seq'::regclass),
  queryable bigint NOT NULL,
  name text NOT NULL,
  "type" text,
  export boolean,
  active boolean,
  "default" boolean,
  caption_en text,
  caption_el text,
  CONSTRAINT pk_resource_fields PRIMARY KEY (id),
  CONSTRAINT fk_queryable FOREIGN KEY (queryable)
      REFERENCES public.resource_queryable (id) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE CASCADE
)
WITH (
  OIDS=FALSE
);

ALTER TABLE public.resource_field
  OWNER TO ckaner;
