import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Tarif, TarifDocument } from './schemas/tarif.schema';
import { CreateTarifDto } from './dto/create-tarif.dto';
import { UpdateTarifDto } from './dto/update-tarif.dto';

@Injectable()
export class TarifsService {
  constructor(
    @InjectModel(Tarif.name) private tarifModel: Model<TarifDocument>,
  ) {}

  create(createTarifDto: CreateTarifDto, centreId: string) {
    const tarif = new this.tarifModel({ ...createTarifDto, centreId });
    return tarif.save();
  }

  findAll(centreId: string) {
    return this.tarifModel.find({ centreId }).sort({ createdAt: 1 }).exec();
  }

  findOne(id: string, centreId: string) {
    return this.tarifModel.findOne({ _id: id, centreId }).exec();
  }

  /**
   * Retourne l'offre active d'un service (une seule offre par service :
   * elle contient son propre tableau de régimes le cas échéant).
   * Utilisé par le module Inscriptions.
   */
  findActifParService(service: string, centreId: string) {
    return this.tarifModel.findOne({ centreId, service, actif: true }).exec();
  }

  async update(id: string, updateTarifDto: UpdateTarifDto, centreId: string) {
    // Quand un champ devient inutile (ex: montantNegociable passe à true),
    // sa valeur est envoyée comme "undefined" par le frontend, ce qui la
    // fait disparaître du JSON. Pour éviter qu'une ancienne valeur ne reste
    // coincée en base, on efface explicitement (via $unset) tout champ
    // rendu inutile par les nouveaux flags reçus dans CETTE requête.
    const setOps: Record<string, unknown> = { ...updateTarifDto };
    const champsAEffacer: string[] = [];

    if (updateTarifDto.montantNegociable === true) {
      champsAEffacer.push('prix');
    }
    if (updateTarifDto.dateFinNecessaire === true) {
      champsAEffacer.push('dureeJours');
    }
    if (updateTarifDto.regimeActif === false) {
      champsAEffacer.push('regimes');
    }

    const unset: Record<string, ''> = {};
    for (const champ of champsAEffacer) {
      // Un champ ne peut pas être $set ET $unset dans la même requête
      // MongoDB : on le retire donc du $set s'il y était encore présent.
      delete setOps[champ];
      unset[champ] = '';
    }

    const operation: Record<string, unknown> = { $set: setOps };
    if (Object.keys(unset).length > 0) {
      operation.$unset = unset;
    }

    const tarif = await this.tarifModel
      .findOneAndUpdate({ _id: id, centreId }, operation, { new: true })
      .exec();

    if (!tarif) {
      throw new NotFoundException('Offre introuvable');
    }
    return tarif;
  }

  async remove(id: string, centreId: string) {
    const tarif = await this.tarifModel.findOneAndDelete({ _id: id, centreId }).exec();
    if (!tarif) {
      throw new NotFoundException('Offre introuvable');
    }
    return tarif;
  }
}